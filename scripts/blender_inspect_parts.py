"""Quick: import original GLB, count loose parts, show their bboxes."""
import json, socket, sys

GLB = "/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/1.3D模型文件-GLB/一毛坐姿.glb"

CODE = f'''
import bpy
GLB = {GLB!r}
for o in list(bpy.data.objects):
    if o.type in {{"MESH","LIGHT","CAMERA"}}:
        bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=GLB)
mesh_objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
print("imported_meshes", len(mesh_objs))
obj = mesh_objs[0]
bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.separate(type="LOOSE")
bpy.ops.object.mode_set(mode="OBJECT")
parts = [o for o in bpy.context.scene.objects if o.type == "MESH"]
print("part_count", len(parts))
# Sort by volume desc, show top 20
def vol(p):
    bb = [p.matrix_world @ __import__("mathutils").Vector(c) for c in p.bound_box]
    xs=[v.x for v in bb]; ys=[v.y for v in bb]; zs=[v.z for v in bb]
    return (max(xs)-min(xs))*(max(ys)-min(ys))*(max(zs)-min(zs))
parts.sort(key=vol, reverse=True)
for p in parts[:25]:
    bb = [p.matrix_world @ __import__("mathutils").Vector(c) for c in p.bound_box]
    xs=[v.x for v in bb]; ys=[v.y for v in bb]; zs=[v.z for v in bb]
    print(p.name, "verts", len(p.data.vertices), "bbox",
          round(min(xs),2), round(min(ys),2), round(min(zs),2),
          round(max(xs),2), round(max(ys),2), round(max(zs),2))
print("...")
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
        print(json.dumps(resp, indent=2, ensure_ascii=False)); sys.exit(0)
    except json.JSONDecodeError: continue
