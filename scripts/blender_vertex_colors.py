"""Color the original GLB by sampling the reference PNG per vertex.

For each vertex, we look up its (x, z) world position, map it into the
character's pixel bbox in the PNG, and use that pixel's color as the
vertex color. Back-facing vertices (normal.y > 0) blend to body pink.

The output GLB stores colors as the standard COLOR_0 vertex attribute —
no UVs, no textures, no baking.
"""
import json
import socket
import sys

GLB = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/1.3D模型文件-GLB/一毛坐姿.glb"
IMG = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/2.一毛动画工程文件/emo3D动画黑色背景（png帧序列+MP4）/png/1_0300.png"
OUT_GLB = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/1.3D模型文件-GLB/一毛坐姿_vcolor.glb"
OUT_PNG = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/1.3D模型文件-GLB/一毛坐姿_vcolor_preview.png"

CODE = r'''
import bpy, math, traceback
import numpy as np
from mathutils import Vector

GLB = {GLB!r}
IMG = {IMG!r}
OUT_GLB = {OUT_GLB!r}
OUT_PNG = {OUT_PNG!r}

def L(*a): print(*a)

try:
    # 1. Reset scene
    for o in list(bpy.data.objects):
        if o.type in {{"MESH", "LIGHT", "CAMERA"}}:
            bpy.data.objects.remove(o, do_unlink=True)

    # 2. Import + join
    bpy.ops.import_scene.gltf(filepath=GLB)
    mesh_objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in mesh_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objs[0]
    if len(mesh_objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    me = obj.data
    L("verts", len(me.vertices))

    # 3. Load image, detect character bbox + body color
    img = bpy.data.images.load(IMG, check_existing=True)
    W, H = img.size[0], img.size[1]
    arr = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
    r_ch = arr[..., 0]; g_ch = arr[..., 1]; b_ch = arr[..., 2]

    # Character mask: distance from the 4 corner colors (corners are background).
    # Any pixel far from all corners is character.
    corners = np.stack([arr[0,0,:3], arr[0,-1,:3], arr[-1,0,:3], arr[-1,-1,:3]], axis=0)  # (4,3)
    diff = arr[..., None, :3] - corners[None, None, :, :]  # (H, W, 4, 3)
    dist2 = (diff * diff).sum(axis=-1)  # (H, W, 4)
    min_dist2 = dist2.min(axis=-1)  # (H, W)
    chr_mask = min_dist2 > 0.005  # ≈ 0.07 per-channel distance
    bg_mask = ~chr_mask
    ys2, xs2 = np.where(chr_mask)
    px_x_min, px_x_max = int(xs2.min()), int(xs2.max())
    px_y_min, px_y_max = int(ys2.min()), int(ys2.max())
    L("char_bbox_px", px_x_min, px_y_min, px_x_max, px_y_max,
      "char_pixels", int(chr_mask.sum()))

    pink_mask = (r_ch > g_ch + 0.04) & (r_ch > b_ch + 0.04) & (r_ch > 0.3)
    body_avg = (float(r_ch[pink_mask].mean()), float(g_ch[pink_mask].mean()), float(b_ch[pink_mask].mean()))
    L("body_avg", round(body_avg[0],3), round(body_avg[1],3), round(body_avg[2],3))

    # 4. World coords + normals
    mw = obj.matrix_world
    mw3 = mw.to_3x3()
    n_verts = len(me.vertices)
    co_arr = np.empty(n_verts * 3, dtype=np.float32)
    me.vertices.foreach_get("co", co_arr)
    co_arr = co_arr.reshape(n_verts, 3)
    nor_arr = np.empty(n_verts * 3, dtype=np.float32)
    me.vertices.foreach_get("normal", nor_arr)
    nor_arr = nor_arr.reshape(n_verts, 3)

    # Apply matrix (assume world matrix is identity-ish or just rotation; we apply it anyway)
    mw_np = np.array([list(row) for row in mw], dtype=np.float32)
    co_h = np.concatenate([co_arr, np.ones((n_verts,1), dtype=np.float32)], axis=1)
    co_w = (co_h @ mw_np.T)[:, :3]
    mw3_np = np.array([list(row) for row in mw3], dtype=np.float32)
    nor_w = nor_arr @ mw3_np.T
    nor_w = nor_w / np.maximum(np.linalg.norm(nor_w, axis=1, keepdims=True), 1e-6)

    x_min, x_max = float(co_w[:,0].min()), float(co_w[:,0].max())
    z_min, z_max = float(co_w[:,2].min()), float(co_w[:,2].max())
    x_rng = max(x_max - x_min, 1e-6)
    z_rng = max(z_max - z_min, 1e-6)
    L("world_bbox_xz", round(x_min,3), round(z_min,3), round(x_max,3), round(z_max,3))

    # 5. Compute per-vertex pixel coords
    fx = (co_w[:,0] - x_min) / x_rng
    fz = (co_w[:,2] - z_min) / z_rng
    px_x = np.clip(np.round(px_x_min + fx * (px_x_max - px_x_min)).astype(np.int32), 0, W-1)
    py = np.clip(np.round(px_y_min + fz * (px_y_max - px_y_min)).astype(np.int32), 0, H-1)

    # Sample colors
    sampled = arr[py, px_x, :3]  # (n_verts, 3)
    # Where sample lies on background, use body color
    sampled_bg = bg_mask[py, px_x]  # (n_verts,)
    sampled[sampled_bg] = body_avg

    # 6. Front-facing factor (normal.y < 0 means facing camera at -Y)
    facing = np.clip(-nor_w[:,1] / 0.3, 0.0, 1.0)  # (n_verts,)
    body = np.array(body_avg, dtype=np.float32)
    final_rgb = sampled * facing[:, None] + body[None, :] * (1.0 - facing[:, None])

    # 7. Write Color Attribute (POINT domain -> glTF COLOR_0)
    for ca in list(me.color_attributes):
        me.color_attributes.remove(ca)
    attr = me.color_attributes.new(name="VCol", type="FLOAT_COLOR", domain="POINT")
    flat = np.concatenate([final_rgb, np.ones((n_verts, 1), dtype=np.float32)], axis=1).reshape(-1)
    attr.data.foreach_set("color", flat)
    me.update()

    # 8. Material: VertexColor -> Base Color (no texture, no UV needed)
    while len(me.uv_layers) > 0:
        me.uv_layers.remove(me.uv_layers[0])
    mat = bpy.data.materials.new("VColMat")
    mat.use_nodes = True
    nt = mat.node_tree
    for n_ in list(nt.nodes):
        nt.nodes.remove(n_)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.55
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "VCol"
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    me.materials.clear()
    me.materials.append(mat)

    # 9. Export GLB (vertex colors via COLOR_0)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        use_selection=True,
        export_format="GLB",
        export_apply=False,
    )
    L("EXPORTED", OUT_GLB)

    # 10. Render proof
    extent_xz = max(x_rng, z_rng)
    y_min, y_max = float(co_w[:,1].min()), float(co_w[:,1].max())
    extent_all = max(extent_xz, y_max - y_min)
    center = Vector(((x_min+x_max)/2, (y_min+y_max)/2, (z_min+z_max)/2))

    cam_data = bpy.data.cameras.new("FrontCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = extent_xz * 1.15
    cam = bpy.data.objects.new("FrontCam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = center + Vector((0, -extent_all*2.0, 0))
    cam.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.scene.camera = cam

    sun_data = bpy.data.lights.new("Sun", type="SUN")
    sun_data.energy = 2.5
    sun_data.angle = math.radians(15)
    sun = bpy.data.objects.new("Sun", sun_data)
    sun.location = center + Vector((extent_all, -extent_all, extent_all))
    sun.rotation_euler = (math.radians(50), math.radians(20), math.radians(-30))
    bpy.context.scene.collection.objects.link(sun)

    sc = bpy.context.scene
    world = sc.world or bpy.data.worlds.new("World")
    sc.world = world
    world.use_nodes = True
    wnt = world.node_tree
    for n_ in list(wnt.nodes): wnt.nodes.remove(n_)
    wo = wnt.nodes.new("ShaderNodeOutputWorld")
    wb = wnt.nodes.new("ShaderNodeBackground")
    wb.inputs["Color"].default_value = (1,1,1,1)
    wb.inputs["Strength"].default_value = 0.6
    wnt.links.new(wb.outputs[0], wo.inputs[0])

    sc.render.engine = "CYCLES"
    sc.cycles.samples = 32
    sc.render.resolution_x = 800
    sc.render.resolution_y = 800
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.filepath = OUT_PNG
    sc.render.film_transparent = False

    bpy.ops.render.render(write_still=True)
    L("RENDERED", OUT_PNG)

except Exception as e:
    print("ERROR", repr(e))
    print(traceback.format_exc())
'''.format(GLB=GLB, IMG=IMG, OUT_GLB=OUT_GLB, OUT_PNG=OUT_PNG)


s = socket.socket(); s.connect(("127.0.0.1", 9876)); s.settimeout(300)
s.sendall(json.dumps({"type":"execute_code","params":{"code":CODE}}).encode())
buf = b""
while True:
    chunk = s.recv(65536)
    if not chunk: break
    buf += chunk
    try:
        resp = json.loads(buf.decode())
        print(json.dumps(resp, indent=2, ensure_ascii=False))
        sys.exit(0 if resp.get("status") == "success" else 1)
    except json.JSONDecodeError:
        continue
print(buf.decode(errors="replace"))
