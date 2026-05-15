"""Front-project the PNG onto the original GLB and render a proof image.

No baking, no back-fill, no GLB export. The output is a single render PNG
that shows the original mesh with the reference image projected from the front.
"""
import json
import socket
import sys

GLB = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/1.3D模型文件-GLB/一毛坐姿.glb"
IMG = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/2.一毛动画工程文件/emo3D动画黑色背景（png帧序列+MP4）/png/1_0300.png"
OUT = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/1.3D模型文件-GLB/一毛坐姿_projection_proof.png"

CODE = r'''
import bpy, math, traceback
from mathutils import Vector

GLB = {GLB!r}
IMG = {IMG!r}
OUT = {OUT!r}

log = []
def L(*a):
    log.append(" ".join(str(x) for x in a))
    print(*a)

try:
    # 1. Reset mesh + lights from prior runs
    for o in list(bpy.data.objects):
        if o.type in {{"MESH", "LIGHT", "CAMERA"}}:
            bpy.data.objects.remove(o, do_unlink=True)

    # 2. Import original GLB
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
    L("mesh", obj.name, "verts", len(me.vertices))

    # 3. World bbox
    mw = obj.matrix_world
    verts_w = [mw @ v.co for v in me.vertices]
    xs=[p.x for p in verts_w]; ys=[p.y for p in verts_w]; zs=[p.z for p in verts_w]
    x_min, x_max = min(xs), max(xs); x_rng = max(x_max-x_min, 1e-6)
    y_min, y_max = min(ys), max(ys)
    z_min, z_max = min(zs), max(zs); z_rng = max(z_max-z_min, 1e-6)
    L("bbox_x", round(x_min,3), round(x_max,3),
      "bbox_y", round(y_min,3), round(y_max,3),
      "bbox_z", round(z_min,3), round(z_max,3))

    # 4. Load image, find pink-character bbox
    img = bpy.data.images.load(IMG, check_existing=True)
    W, H = img.size[0], img.size[1]
    import numpy as np
    arr = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
    r = arr[..., 0]; g = arr[..., 1]; b = arr[..., 2]
    mask = (r > g + 0.04) & (r > b + 0.04) & (r > 0.3)
    ys2, xs2 = np.where(mask)
    if xs2.size > 0:
        px_x_min, px_x_max = int(xs2.min()), int(xs2.max())
        px_y_min, px_y_max = int(ys2.min()), int(ys2.max())
    else:
        px_x_min, px_y_min = 0, 0
        px_x_max, px_y_max = W-1, H-1
    u_min = px_x_min / W
    u_max = (px_x_max + 1) / W
    v_min = px_y_min / H
    v_max = (px_y_max + 1) / H
    u_rng = max(u_max - u_min, 1e-6)
    v_rng = max(v_max - v_min, 1e-6)
    L("pink_bbox_px", px_x_min, px_y_min, px_x_max, px_y_max)
    L("uv_rect", round(u_min,3), round(v_min,3), round(u_max,3), round(v_max,3))

    # 5. Front-projection UVs (replace any existing UV layers)
    while len(me.uv_layers) > 0:
        me.uv_layers.remove(me.uv_layers[0])
    proj_uv = me.uv_layers.new(name="ProjUV")
    proj_data = proj_uv.data
    for poly in me.polygons:
        for li in poly.loop_indices:
            p = verts_w[me.loops[li].vertex_index]
            u = u_min + (p.x - x_min) / x_rng * u_rng
            v = v_min + (p.z - z_min) / z_rng * v_rng
            proj_data[li].uv = (u, v)
    me.uv_layers.active_index = 0
    me.uv_layers["ProjUV"].active_render = True

    # 6. Material: ProjUV -> ImageTexture(CLIP) -> Base Color. No fallback.
    mat = bpy.data.materials.new("ProjOnly")
    mat.use_nodes = True
    nt = mat.node_tree
    for n_ in list(nt.nodes):
        nt.nodes.remove(n_)
    out_n = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    uv_n = nt.nodes.new("ShaderNodeUVMap"); uv_n.uv_map = "ProjUV"
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img; tex.extension = "CLIP"
    nt.links.new(uv_n.outputs["UV"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out_n.inputs["Surface"])
    obj.data.materials.clear()
    obj.data.materials.append(mat)

    # 7. Camera (orthographic, looking down -Y)
    center = Vector(((x_min+x_max)/2, (y_min+y_max)/2, (z_min+z_max)/2))
    extent_xz = max(x_rng, z_rng)
    extent_all = max(x_rng, max(y_max-y_min, 1e-6), z_rng)
    cam_data = bpy.data.cameras.new("FrontCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = extent_xz * 1.15
    cam = bpy.data.objects.new("FrontCam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = center + Vector((0, -extent_all*2.0, 0))
    cam.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.scene.camera = cam

    # 8. White world background, Cycles
    sc = bpy.context.scene
    world = sc.world or bpy.data.worlds.new("World")
    sc.world = world
    world.use_nodes = True
    wnt = world.node_tree
    for n_ in list(wnt.nodes): wnt.nodes.remove(n_)
    wo = wnt.nodes.new("ShaderNodeOutputWorld")
    wb = wnt.nodes.new("ShaderNodeBackground")
    wb.inputs["Color"].default_value = (1,1,1,1)
    wb.inputs["Strength"].default_value = 3.0
    wnt.links.new(wb.outputs[0], wo.inputs[0])

    sc.render.engine = "CYCLES"
    sc.cycles.samples = 32
    sc.render.resolution_x = 800
    sc.render.resolution_y = 800
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.filepath = OUT
    sc.render.film_transparent = False

    bpy.ops.render.render(write_still=True)
    L("RENDERED", OUT)

except Exception as e:
    L("ERROR", repr(e))
    L(traceback.format_exc())
'''.format(GLB=GLB, IMG=IMG, OUT=OUT)


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
