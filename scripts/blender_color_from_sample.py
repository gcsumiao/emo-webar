"""Color the original GLB with a flat material whose base color is sampled
from the reference PNG. The PNG is used as a color sample only — it is NOT
projected, baked, or embedded as a texture in the output GLB.

Outputs:
  - <model>_flat.glb       : colored GLB (single Principled BSDF, no texture)
  - <model>_flat_preview.png : Cycles render proof
"""
import json
import socket
import sys

GLB = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/1.3D模型文件-GLB/一毛坐姿.glb"
IMG = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/2.一毛动画工程文件/emo3D动画黑色背景（png帧序列+MP4）/png/1_0300.png"
OUT_GLB = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/1.3D模型文件-GLB/一毛坐姿_flat.glb"
OUT_PNG = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/1.3D模型文件-GLB/一毛坐姿_flat_preview.png"

CODE = r'''
import bpy, math, traceback
from mathutils import Vector

GLB = {GLB!r}
IMG = {IMG!r}
OUT_GLB = {OUT_GLB!r}
OUT_PNG = {OUT_PNG!r}

def L(*a): print(*a)

try:
    # 1. Reset scene objects from prior runs
    for o in list(bpy.data.objects):
        if o.type in {{"MESH", "LIGHT", "CAMERA"}}:
            bpy.data.objects.remove(o, do_unlink=True)

    # 2. Import GLB, join into one object
    bpy.ops.import_scene.gltf(filepath=GLB)
    mesh_objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in mesh_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objs[0]
    if len(mesh_objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    L("mesh", obj.name, "verts", len(obj.data.vertices))

    # 3. Sample dominant pink from the reference image
    img = bpy.data.images.load(IMG, check_existing=True)
    W, H = img.size[0], img.size[1]
    import numpy as np
    arr = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
    r = arr[..., 0]; g = arr[..., 1]; b = arr[..., 2]
    mask = (r > g + 0.04) & (r > b + 0.04) & (r > 0.3)
    if mask.any():
        rgb = (float(r[mask].mean()), float(g[mask].mean()), float(b[mask].mean()))
    else:
        rgb = (0.94, 0.68, 0.72)
    L("sampled_rgb", round(rgb[0],3), round(rgb[1],3), round(rgb[2],3))

    # 4. Flat material, no texture
    mat = bpy.data.materials.new("FlatPink")
    mat.use_nodes = True
    nt = mat.node_tree
    for n_ in list(nt.nodes):
        nt.nodes.remove(n_)
    out_n = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
    bsdf.inputs["Roughness"].default_value = 0.55
    nt.links.new(bsdf.outputs["BSDF"], out_n.inputs["Surface"])

    obj.data.materials.clear()
    obj.data.materials.append(mat)

    # 5. Strip any existing UV layers — flat material doesn't need them, keeps GLB lean
    while len(obj.data.uv_layers) > 0:
        obj.data.uv_layers.remove(obj.data.uv_layers[0])

    # 6. Export GLB
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

    # 7. Render proof: front orthographic in Cycles
    mw = obj.matrix_world
    verts_w = [mw @ v.co for v in obj.data.vertices]
    xs=[p.x for p in verts_w]; ys=[p.y for p in verts_w]; zs=[p.z for p in verts_w]
    x_min,x_max=min(xs),max(xs); y_min,y_max=min(ys),max(ys); z_min,z_max=min(zs),max(zs)
    center = Vector(((x_min+x_max)/2, (y_min+y_max)/2, (z_min+z_max)/2))
    extent_xz = max(x_max-x_min, z_max-z_min)
    extent_all = max(extent_xz, y_max-y_min)

    cam_data = bpy.data.cameras.new("FrontCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = extent_xz * 1.15
    cam = bpy.data.objects.new("FrontCam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = center + Vector((0, -extent_all*2.0, 0))
    cam.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.scene.camera = cam

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

    # Directional sun for shape definition
    sun_data = bpy.data.lights.new("Sun", type="SUN")
    sun_data.energy = 2.5
    sun_data.angle = math.radians(15)
    sun = bpy.data.objects.new("Sun", sun_data)
    sun.location = center + Vector((extent_all, -extent_all, extent_all))
    sun.rotation_euler = (math.radians(50), math.radians(20), math.radians(-30))
    bpy.context.scene.collection.objects.link(sun)

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
