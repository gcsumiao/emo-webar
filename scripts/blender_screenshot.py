"""Ask Blender (via MCP) to render a quick preview of the colored object."""
import json, socket, sys

OUT_PNG = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/1.3D模型文件-GLB/一毛坐姿_preview.png"

CODE = f'''
import bpy, math
from mathutils import Vector

OUT = {OUT_PNG!r}

obj = next((o for o in bpy.context.scene.objects if o.type == "MESH"), None)
if obj is None:
    print("NO_MESH"); raise SystemExit
me = obj.data

# Center on object
mw = obj.matrix_world
verts_w = [mw @ v.co for v in me.vertices]
xs=[p.x for p in verts_w]; ys=[p.y for p in verts_w]; zs=[p.z for p in verts_w]
center = Vector(((min(xs)+max(xs))/2, (min(ys)+max(ys))/2, (min(zs)+max(zs))/2))
extent = max(max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))

# Camera looking from -Y toward origin (front view)
cam_data = bpy.data.cameras.new("PreviewCam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = extent * 1.2
cam = bpy.data.objects.new("PreviewCam", cam_data)
bpy.context.scene.collection.objects.link(cam)
cam.location = center + Vector((0, -extent*2.0, 0))
cam.rotation_euler = (math.radians(90), 0, 0)
bpy.context.scene.camera = cam

# Bright world background so lighting isn't an issue
sc = bpy.context.scene
world = sc.world or bpy.data.worlds.new("World")
sc.world = world
world.use_nodes = True
nt = world.node_tree
for n in list(nt.nodes): nt.nodes.remove(n)
out_n = nt.nodes.new("ShaderNodeOutputWorld")
bg_n = nt.nodes.new("ShaderNodeBackground")
bg_n.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
bg_n.inputs["Strength"].default_value = 3.0
nt.links.new(bg_n.outputs[0], out_n.inputs[0])

sc.render.engine = "CYCLES"
sc.cycles.samples = 16
sc.render.resolution_x = 800
sc.render.resolution_y = 800
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT
sc.render.film_transparent = False

bpy.ops.render.render(write_still=True)
print("PREVIEW", OUT)
'''

s = socket.socket(); s.connect(("127.0.0.1", 9876)); s.settimeout(120)
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
