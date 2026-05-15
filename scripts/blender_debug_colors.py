"""Debug: load colored GLB, sample some vertex colors, render at higher quality."""
import json, socket, sys

GLB = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/1.3D模型文件-GLB/一毛坐姿_vcolor.glb"
OUT_PNG = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/1.3D模型文件-GLB/一毛坐姿_vcolor_preview2.png"

CODE = f'''
import bpy, math
from mathutils import Vector

GLB = {GLB!r}
OUT_PNG = {OUT_PNG!r}

for o in list(bpy.data.objects):
    if o.type in {{"MESH","LIGHT","CAMERA"}}:
        bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.import_scene.gltf(filepath=GLB)
obj = next(o for o in bpy.context.scene.objects if o.type == "MESH")
me = obj.data
print("verts", len(me.vertices), "color_attrs", [a.name for a in me.color_attributes])

attr = me.color_attributes[0] if len(me.color_attributes) else None
if attr is None:
    print("NO COLOR ATTR")
else:
    # Find topmost, bottom, leftmost vertices
    mw = obj.matrix_world
    verts_w = [(i, mw @ v.co) for i,v in enumerate(me.vertices)]
    top = max(verts_w, key=lambda t: t[1].z)
    bot = min(verts_w, key=lambda t: t[1].z)
    left = min(verts_w, key=lambda t: t[1].x)
    right = max(verts_w, key=lambda t: t[1].x)
    fwd = min(verts_w, key=lambda t: t[1].y)
    print("top idx", top[0], "wpos", round(top[1].x,2), round(top[1].y,2), round(top[1].z,2),
          "color", [round(c,3) for c in attr.data[top[0]].color])
    print("bot idx", bot[0], "wpos", round(bot[1].x,2), round(bot[1].y,2), round(bot[1].z,2),
          "color", [round(c,3) for c in attr.data[bot[0]].color])
    print("left idx", left[0], "wpos", round(left[1].x,2), round(left[1].y,2), round(left[1].z,2),
          "color", [round(c,3) for c in attr.data[left[0]].color])
    print("right idx", right[0], "wpos", round(right[1].x,2), round(right[1].y,2), round(right[1].z,2),
          "color", [round(c,3) for c in attr.data[right[0]].color])
    print("fwd idx", fwd[0], "wpos", round(fwd[1].x,2), round(fwd[1].y,2), round(fwd[1].z,2),
          "color", [round(c,3) for c in attr.data[fwd[0]].color])

# Bright render
mw = obj.matrix_world
verts_w = [mw @ v.co for v in me.vertices]
xs=[p.x for p in verts_w]; ys=[p.y for p in verts_w]; zs=[p.z for p in verts_w]
center = Vector(((min(xs)+max(xs))/2, (min(ys)+max(ys))/2, (min(zs)+max(zs))/2))
extent_xz = max(max(xs)-min(xs), max(zs)-min(zs))
extent_all = max(extent_xz, max(ys)-min(ys))

cam_data = bpy.data.cameras.new("FrontCam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = extent_xz * 1.15
cam = bpy.data.objects.new("FrontCam", cam_data)
bpy.context.scene.collection.objects.link(cam)
cam.location = center + Vector((0, -extent_all*2.0, 0))
cam.rotation_euler = (math.radians(90), 0, 0)
bpy.context.scene.camera = cam

sun_data = bpy.data.lights.new("Sun", type="SUN")
sun_data.energy = 3.5
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
wb.inputs["Color"].default_value = (0.95,0.95,0.95,1)
wb.inputs["Strength"].default_value = 0.4
wnt.links.new(wb.outputs[0], wo.inputs[0])

sc.render.engine = "CYCLES"
sc.cycles.samples = 64
sc.render.resolution_x = 1200
sc.render.resolution_y = 1200
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT_PNG

# Need to make sure imported material correctly references the vertex color layer
mat = obj.data.materials[0] if len(obj.data.materials) > 0 else None
print("mat", mat.name if mat else None, "use_nodes", mat.use_nodes if mat else None)
if mat:
    nt = mat.node_tree
    print("nodes", [(n.name, n.type) for n in nt.nodes])

bpy.ops.render.render(write_still=True)
print("RENDERED", OUT_PNG)
'''

s = socket.socket(); s.connect(("127.0.0.1", 9876)); s.settimeout(300)
s.sendall(json.dumps({"type":"execute_code","params":{"code":CODE}}).encode())
buf=b""
while True:
    chunk = s.recv(65536)
    if not chunk: break
    buf+=chunk
    try:
        r=json.loads(buf.decode()); print(json.dumps(r, indent=2, ensure_ascii=False)); sys.exit(0)
    except: continue
