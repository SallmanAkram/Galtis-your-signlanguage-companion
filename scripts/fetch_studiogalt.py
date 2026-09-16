import urllib.request
import json
import math
import os

def quat_to_euler(w, x, y, z):
    sinr_cosp = 2 * (w * x + y * z)
    cosr_cosp = 1 - 2 * (x * x + y * y)
    roll = math.atan2(sinr_cosp, cosr_cosp)

    sinp = 2 * (w * y - z * x)
    if abs(sinp) >= 1:
        pitch = math.copysign(math.pi / 2, sinp)
    else:
        pitch = math.asin(sinp)

    siny_cosp = 2 * (w * z + x * y)
    cosy_cosp = 1 - 2 * (y * y + z * z)
    yaw = math.atan2(siny_cosp, cosy_cosp)

    return [round(math.degrees(roll), 2), round(math.degrees(pitch), 2), round(math.degrees(yaw), 2)]

words = [
    {
        "id": "sg-hello",
        "word": "HELLO",
        "gloss": "HELLO / HI",
        "category": "Greetings & Social",
        "letter": "ASL H",
        "folder": "SG ASL Hello 2024-6-9 Upload",
        "base": "SG_ASL_Hello_2024-6-9",
        "poses": [("P1", 1), ("P2", 50)],
        "facs": {"browRaise": 0.25, "mouthSmile": 0.35, "eyeBlink": 0.0},
        "description": "Standard ASL greeting sign. Open flat hand touches near temple and salutes outward with a friendly smile."
    },
    {
        "id": "sg-please",
        "word": "PLEASE",
        "gloss": "PLEASE",
        "category": "Greetings & Social",
        "letter": "ASL P",
        "folder": "SG ASL Please 2024-10-13 Upload",
        "base": "SG_ASL_Please_2024-10-13",
        "poses": [("P1", 1), ("P2", 30), ("P3", 60), ("P4", 90)],
        "facs": {"browRaise": 0.15, "mouthSmile": 0.2, "eyeBlink": 0.0},
        "description": "Circular clockwise rubbing motion of flat open hand over the chest showing sincere politeness."
    },
    {
        "id": "sg-my",
        "word": "MY",
        "gloss": "MY / MINE",
        "category": "Pronouns & Identity",
        "letter": "ASL M",
        "folder": "SG ASL My 2024-6-9 Upload",
        "base": "SG_ASL_My_2024-6-9",
        "poses": [("P1", 1), ("P2", 45)],
        "facs": {"browRaise": 0.0, "mouthSmile": 0.1, "eyeBlink": 0.0},
        "description": "Possessive pronoun. Flat right hand placed firmly against the center of the chest."
    },
    {
        "id": "sg-my-name-is",
        "word": "MY NAME IS",
        "gloss": "MY NAME",
        "category": "Pronouns & Identity",
        "letter": "ASL M",
        "folder": "SG ASL My Name Is 2024-6-9 Upload",
        "base": "SG_ASL_My_Name_Is_2024-6-9",
        "poses": [("P1", 1), ("P2", 25), ("P3", 50), ("P4", 75), ("P5", 100), ("P6", 125)],
        "facs": {"browRaise": 0.25, "mouthSmile": 0.3, "eyeBlink": 0.0},
        "description": "Composite ASL introduction: Signs MY (flat palm to chest), then taps both H-hands across each other twice for NAME."
    },
    {
        "id": "sg-you",
        "word": "YOU",
        "gloss": "YOU",
        "category": "Pronouns & Identity",
        "letter": "ASL Y",
        "folder": "SG ASL You 2025-7-22 Upload",
        "base": "SG_ASL_You_2025-7-22",
        "poses": [("P1", 1), ("P2", 40)],
        "facs": {"browRaise": 0.1, "mouthSmile": 0.15, "eyeBlink": 0.0},
        "description": "Deictic pointing gesture directed straightforward toward the conversation partner."
    },
    {
        "id": "sg-where",
        "word": "WHERE",
        "gloss": "WHERE (WH-Q)",
        "category": "Questions",
        "letter": "ASL W",
        "folder": "SG ASL Where Var 2025-7-24 Upload",
        "base": "SG_ASL_Where_Var_2025-7-24",
        "poses": [("P1", 1), ("P2", 45)],
        "facs": {"browFurrow": 0.65, "headTilt": 0.15, "mouthPucker": 0.2},
        "description": "Upright index finger pivoting side to side with furrowed brow (characteristic ASL WH-question grammatical marker)."
    },
    {
        "id": "sg-which",
        "word": "WHICH",
        "gloss": "WHICH",
        "category": "Questions",
        "letter": "ASL W",
        "folder": "SG ASL Which 2025-7-22 Upload",
        "base": "SG_ASL_Which_2025-7-22",
        "poses": [("P1", 1), ("P2", 50)],
        "facs": {"browFurrow": 0.5, "headTilt": -0.1, "mouthOpen": 0.1},
        "description": "Alternating vertical oscillation of both A-hands with upright thumbs weighing between alternatives."
    },
    {
        "id": "sg-this",
        "word": "THIS",
        "gloss": "THIS",
        "category": "Pronouns & Identity",
        "letter": "ASL T",
        "folder": "SG ASL This 2025-7-23 Upload",
        "base": "SG_ASL_This_2025-7-23",
        "poses": [("P1", 1), ("P2", 40)],
        "facs": {"browRaise": 0.1, "mouthSmile": 0.05, "eyeBlink": 0.0},
        "description": "Dominant index finger descends onto flat open non-dominant palm to indicate present subject."
    },
    {
        "id": "sg-take",
        "word": "TAKE",
        "gloss": "TAKE / ADOPT",
        "category": "Core Verbs",
        "letter": "ASL T",
        "folder": "SG ASL Take 2024-10-13 Upload",
        "base": "SG_ASL_Take_2024-10-13",
        "poses": [("P1", 1), ("P2", 55)],
        "facs": {"browRaise": 0.0, "mouthSmile": 0.1, "eyeBlink": 0.0},
        "description": "Both open claw hands reach forward, grasping inward and pulling back into solid S-fists."
    },
    {
        "id": "sg-equal",
        "word": "EQUAL",
        "gloss": "EQUAL / FAIR",
        "category": "Concepts & Descriptors",
        "letter": "ASL E",
        "folder": "SG ASL Equal 2025-7-23 Upload",
        "base": "SG_ASL_Equal_2025-7-23",
        "poses": [("P1", 1), ("P2", 45)],
        "facs": {"browRaise": 0.1, "mouthSmile": 0.2, "eyeBlink": 0.0},
        "description": "Both bent hands with fingers extended facing together, gently tapping fingertips in parallel equilibrium."
    },
    {
        "id": "sg-everyone",
        "word": "EVERYONE",
        "gloss": "EVERYONE / ALL",
        "category": "Concepts & Descriptors",
        "letter": "ASL E",
        "folder": "SG ASL Everyone 2025-7-23 Upload",
        "base": "SG_ASL_Everyone_2025-7-23",
        "poses": [("P1", 1), ("P2", 60)],
        "facs": {"browRaise": 0.3, "mouthSmile": 0.25, "eyeBlink": 0.0},
        "description": "Compound sign: Right A-hand brushes knuckles down back of left A-hand, then ascends into ONE."
    },
    {
        "id": "sg-future",
        "word": "FUTURE",
        "gloss": "FUTURE / LATER",
        "category": "Time & Space",
        "letter": "ASL F",
        "folder": "SG ASL Future 2025-7-23 Upload",
        "base": "SG_ASL_Future_2025-7-23",
        "poses": [("P1", 1), ("P2", 50)],
        "facs": {"browRaise": 0.2, "mouthSmile": 0.15, "headTilt": 0.05},
        "description": "Open flat hand begins near cheek and arcs smoothly forward into the distance along the ASL time line."
    },
    {
        "id": "sg-or",
        "word": "OR",
        "gloss": "OR / EITHER",
        "category": "Concepts & Descriptors",
        "letter": "ASL O",
        "folder": "SG ASL Or 2025-7-21 Upload",
        "base": "SG_ASL_Or_2025-7-21",
        "poses": [("P1", 1), ("P2", 40)],
        "facs": {"browRaise": 0.15, "mouthOpen": 0.1, "eyeBlink": 0.0},
        "description": "Dominant index finger touches thumb of stationary non-dominant hand, then shifts to index finger."
    }
]

parsed_data = []

for w in words:
    folder_str = w["folder"]
    base_str = w["base"]
    entry = {
        "id": w["id"],
        "word": w["word"],
        "gloss": w["gloss"],
        "category": w["category"],
        "source": "StudioGalt / " + folder_str,
        "parentMotion": "Galtis 8 (" + base_str + ")",
        "description": w["description"],
        "facs": w["facs"],
        "fps": 60,
        "keyposes": []
    }
    
    for p_name, frame in w["poses"]:
        url = "https://raw.githubusercontent.com/StudioGalt/Sign-Language-Mocap-Archive/main/SG%20ASL%20Dictionary/" + urllib.parse.quote(w["letter"]) + "/" + urllib.parse.quote(folder_str) + "/Poses/JSON/jpm_" + urllib.parse.quote(base_str) + "_" + p_name + ".json"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req) as resp:
                raw = json.loads(resp.read())[0]
                bones_map = {}
                for b in raw.get("bones", []):
                    name = b["name"]
                    if any(k in name for k in ["bicep", "forearm", "hand", "thumb", "index", "middle", "ring", "pinky", "collar", "neck", "head", "chest"]):
                        q = b.get("rotation", {}).get("vector", [1, 0, 0, 0])
                        pos = b.get("location", {}).get("vector", [0, 0, 0])
                        euler = quat_to_euler(q[0], q[1], q[2], q[3])
                        bones_map[name] = {
                            "quaternion": [round(x, 4) for x in q],
                            "position": [round(x, 4) for x in pos],
                            "eulerDegrees": euler
                        }
                entry["keyposes"].append({
                    "poseId": p_name,
                    "frame": frame,
                    "boneCount": len(bones_map),
                    "bones": bones_map
                })
        except Exception as e:
            print("Error fetching", w["word"], p_name, ":", e)

    parsed_data.append(entry)
    print("Loaded", entry["word"], ":", len(entry["keyposes"]), "keyposes")

os.makedirs("src/data", exist_ok=True)
with open("src/data/studioGaltDictionaryData.json", "w") as f:
    json.dump(parsed_data, f, indent=2)

print("SUCCESS: Saved", len(parsed_data), "words to src/data/studioGaltDictionaryData.json")
