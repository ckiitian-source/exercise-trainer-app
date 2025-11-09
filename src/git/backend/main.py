from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uuid
import httpx
import json
import re

app = FastAPI()

origins = ["http://localhost:5173", "http://localhost:3000", "*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_headers=["*"],
    allow_methods=["*"],
    allow_credentials=True,
)

class VideoAnalysisRequest(BaseModel):
    video_id: str
    muscle_group: str
    exercise_name: str
    video_base64: Optional[str] = None

class UploadUrlRequest(BaseModel):
    filename: str
    size_bytes: int
    user_id: str

class UploadUrlResponse(BaseModel):
    upload_url: str
    video_id: str

API_KEY = "AIzaSyCRXsopDXRUVzCrJpTZRba6oQRzn6arklU"

# Enhanced exercise database with proper form cues
EXERCISES_BY_MUSCLE = {
    "Chest": {
        "Push-ups": {
            "sets": "3-4", 
            "reps": "8-12", 
            "rest": "60s",
            "form_cues": [
                "Hands shoulder-width apart",
                "Body forms straight line from head to heels",
                "Elbows at 45° angle to body",
                "Lower until chest nearly touches ground",
                "Keep core engaged throughout"
            ],
            "common_mistakes": [
                "Sagging hips",
                "Flaring elbows out too wide",
                "Not going deep enough",
                "Neck craning forward"
            ]
        },
        "Bench Press": {
            "sets": "4", 
            "reps": "6-10", 
            "rest": "90s",
            "form_cues": [
                "Feet flat on floor",
                "Shoulder blades retracted and depressed",
                "Bar path straight over mid-chest",
                "5-point contact: head, shoulders, glutes, feet",
                "Controlled descent, explosive press"
            ],
            "common_mistakes": [
                "Bouncing bar off chest",
                "Lifting glutes off bench",
                "Bar path too high toward neck",
                "Uneven bar press"
            ]
        },
        "Incline Press": {"sets": "3", "reps": "8-12", "rest": "60s"},
        "Dumbbell Flyes": {"sets": "3", "reps": "10-15", "rest": "45s"},
        "Cable Crossovers": {"sets": "3", "reps": "12-15", "rest": "45s"},
    },
    "Back": {
        "Pull-ups": {
            "sets": "3-4", 
            "reps": "6-12", 
            "rest": "90s",
            "form_cues": [
                "Dead hang start position",
                "Pull shoulder blades down and back first",
                "Lead with chest, not chin",
                "Full range of motion",
                "Controlled descent"
            ],
            "common_mistakes": [
                "Using momentum/swinging",
                "Not reaching full extension",
                "Shrugging shoulders up",
                "Incomplete reps"
            ]
        },
        "Barbell Rows": {"sets": "4", "reps": "6-8", "rest": "90s"},
        "Lat Pulldowns": {"sets": "3", "reps": "8-12", "rest": "60s"},
        "Bent-over Rows": {"sets": "4", "reps": "6-10", "rest": "75s"},
        "Face Pulls": {"sets": "3", "reps": "15-20", "rest": "45s"},
    },
    "Legs": {
        "Squats": {
            "sets": "4", 
            "reps": "6-10", 
            "rest": "90s",
            "form_cues": [
                "Feet shoulder-width apart",
                "Weight on mid-foot, not toes",
                "Knees track over toes",
                "Hip crease below knee for depth",
                "Neutral spine throughout"
            ],
            "common_mistakes": [
                "Knees caving inward",
                "Heels lifting off ground",
                "Forward lean/chest dropping",
                "Insufficient depth"
            ]
        },
        "Lunges": {"sets": "3", "reps": "10-12", "rest": "60s"},
        "Leg Press": {"sets": "3", "reps": "8-12", "rest": "75s"},
        "Leg Curls": {"sets": "3", "reps": "10-15", "rest": "45s"},
        "Calf Raises": {"sets": "3", "reps": "15-20", "rest": "30s"},
    },
    "Arms": {
        "Bicep Curls": {
            "sets": "3-4", 
            "reps": "8-12", 
            "rest": "60s",
            "form_cues": [
                "Elbows stationary at sides",
                "Controlled curl with supination",
                "No swinging or momentum",
                "Full extension at bottom",
                "Squeeze at top"
            ],
            "common_mistakes": [
                "Swinging body for momentum",
                "Moving elbows forward",
                "Partial range of motion",
                "Using too much weight"
            ]
        },
        "Tricep Dips": {"sets": "3", "reps": "8-12", "rest": "60s"},
        "Hammer Curls": {"sets": "3", "reps": "10-12", "rest": "45s"},
        "Tricep Extensions": {"sets": "3", "reps": "10-15", "rest": "45s"},
        "Preacher Curls": {"sets": "3", "reps": "8-12", "rest": "60s"},
    },
    "Shoulders": {
        "Shoulder Press": {
            "sets": "4", 
            "reps": "6-10", 
            "rest": "90s",
            "form_cues": [
                "Core braced, slight back arch",
                "Press straight overhead",
                "Full lockout at top",
                "Controlled descent to chin level",
                "Elbows slightly forward"
            ],
            "common_mistakes": [
                "Excessive back arch",
                "Pressing forward not up",
                "Incomplete lockout",
                "Using legs for momentum"
            ]
        },
        "Lateral Raises": {"sets": "3", "reps": "12-15", "rest": "45s"},
        "Military Press": {"sets": "3", "reps": "6-8", "rest": "90s"},
        "Shrugs": {"sets": "3", "reps": "12-15", "rest": "45s"},
        "Upright Rows": {"sets": "3", "reps": "8-10", "rest": "60s"},
    },
    "Core": {
        "Planks": {
            "sets": "3", 
            "reps": "30-60s", 
            "rest": "45s",
            "form_cues": [
                "Straight line from head to heels",
                "Elbows under shoulders",
                "Core engaged, glutes squeezed",
                "Neutral neck position",
                "Breathe steadily"
            ],
            "common_mistakes": [
                "Hips sagging or piking",
                "Head dropping",
                "Not engaging core",
                "Holding breath"
            ]
        },
        "Crunches": {"sets": "3", "reps": "15-20", "rest": "45s"},
        "Leg Raises": {"sets": "3", "reps": "10-15", "rest": "45s"},
        "Russian Twists": {"sets": "3", "reps": "20", "rest": "45s"},
        "Mountain Climbers": {"sets": "3", "reps": "20", "rest": "45s"},
    },
}

async def call_gemini_api_with_vision(prompt: str, video_base64: str = None):
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={API_KEY}"
    
    headers = {
        "Content-Type": "application/json",
    }
    
    if video_base64:
        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "video/mp4",
                            "data": video_base64
                        }
                    }
                ]
            }],
            "generationConfig": {
                "temperature": 0.4,
                "topP": 0.8,
                "topK": 40,
                "maxOutputTokens": 2048,
            }
        }
    else:
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }]
        }
    
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(api_url, headers=headers, json=payload)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"API Error: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Exception: {str(e)}")
        return None

@app.get("/api/exercises")
async def get_exercises(muscle_group: str):
    exercises_data = EXERCISES_BY_MUSCLE.get(muscle_group, {})
    return {"exercises": list(exercises_data.keys())}

@app.get("/api/exercise-details")
async def get_exercise_details(muscle_group: str, exercise_name: str):
    exercise_data = EXERCISES_BY_MUSCLE.get(muscle_group, {}).get(exercise_name, {})
    return {
        "exercise": exercise_name,
        "muscle_group": muscle_group,
        "sets": exercise_data.get("sets", "3"),
        "reps": exercise_data.get("reps", "8-12"),
        "rest": exercise_data.get("rest", "60s"),
        "form_cues": exercise_data.get("form_cues", []),
        "common_mistakes": exercise_data.get("common_mistakes", [])
    }

def extract_json_from_text(text: str) -> dict:
    """Enhanced JSON extraction with multiple strategies"""
    # Strategy 1: Find JSON between code blocks
    code_block_pattern = r'``````'
    match = re.search(code_block_pattern, text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except:
            pass
    
    # Strategy 2: Find raw JSON object
    json_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
    matches = re.finditer(json_pattern, text, re.DOTALL)
    
    for match in matches:
        try:
            potential_json = match.group(0)
            parsed = json.loads(potential_json)
            # Validate it has expected structure
            if "form_score" in parsed or "assessment" in parsed:
                return parsed
        except:
            continue
    
    # Strategy 3: Brute force find first { to last }
    start = text.find('{')
    end = text.rfind('}')
    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except:
            pass
    
    return None

@app.post("/api/video/analyze")
async def analyze_video(req: VideoAnalysisRequest):
    exercise_name = req.exercise_name
    muscle_group = req.muscle_group
    
    # Get exercise-specific information
    exercise_info = EXERCISES_BY_MUSCLE.get(muscle_group, {}).get(exercise_name, {})
    form_cues = exercise_info.get("form_cues", [])
    common_mistakes = exercise_info.get("common_mistakes", [])
    
    # Build contextual cues
    form_cues_text = "\n".join([f"  ✓ {cue}" for cue in form_cues]) if form_cues else ""
    mistakes_text = "\n".join([f"  ✗ {mistake}" for mistake in common_mistakes]) if common_mistakes else ""
    
    # Enhanced prompt with exercise-specific context
    prompt = f"""You are an ELITE certified strength & conditioning coach analyzing a video of {exercise_name} for {muscle_group}.

**CORRECT FORM CHECKLIST for {exercise_name}:**
{form_cues_text}

**COMMON MISTAKES TO CHECK FOR:**
{mistakes_text}

**YOUR TASK:**
1. Watch the ENTIRE video carefully
2. Identify SPECIFIC form issues you observe (not generic advice)
3. For each issue, explain EXACTLY what you see wrong and HOW to fix it
4. Rate form quality 1-10 (be critical but fair)
5. Provide confidence level for each observation

**RESPOND WITH VALID JSON ONLY (no markdown, no extra text):**

{{
  "form_score": <1-10 integer>,
  "confidence": <1-100 integer, how confident in analysis>,
  "assessment": "<2-3 sentence professional summary of overall form>",
  "feedback_pairs": [
    {{
      "id": 1,
      "body_part": "<specific body part: e.g., 'Lower Back', 'Left Elbow', 'Knees'>",
      "issue": "<SPECIFIC observation from video: what you SAW wrong>",
      "correction": "<SPECIFIC actionable fix: exact steps to correct>",
      "severity": "<critical|high|medium|low>",
      "risk": "<specific injury risk if not corrected>",
      "timestamp": "<approximate time in video when visible, e.g., '0:03-0:05'>",
      "confidence": <1-100 integer, confidence in this specific issue>
    }}
  ],
  "strengths": ["<specific thing done well>", "<another strength>"],
  "next_steps": [
    "<immediate priority fix>",
    "<secondary improvement>",
    "<progression suggestion>"
  ],
  "rep_count": <approximate number of reps completed>,
  "tempo_analysis": "<assessment of movement speed and control>"
}}

**CRITICAL RULES:**
- BE SPECIFIC: "Left knee caves inward during descent" NOT "bad knee alignment"
- PROVIDE EXACT FIXES: "Actively push knees outward, think 'spreading the floor'" NOT "fix your knees"
- CONFIDENCE SCORING: 80-100 = very clear issue, 60-79 = likely issue, below 60 = uncertain
- ONLY report issues you actually SEE in the video
- If form is excellent, say so! High scores are allowed.
- Respond with ONLY the JSON object, nothing else"""

    try:
        result = await call_gemini_api_with_vision(prompt, req.video_base64)
        
        if not result:
            return {
                "video_id": req.video_id,
                "exercise": exercise_name,
                "error": "API timeout - Please try again",
                "form_score": 0,
                "confidence": 0,
                "feedback_pairs": [],
            }
        
        feedback_text = ""
        if "candidates" in result and len(result["candidates"]) > 0:
            feedback_text = result["candidates"][0]["content"]["parts"][0]["text"]
        
        # Enhanced JSON extraction
        analysis = extract_json_from_text(feedback_text)
        
        if analysis:
            # Validate and enhance analysis
            if "feedback_pairs" in analysis:
                for i, pair in enumerate(analysis["feedback_pairs"]):
                    # Add defaults if missing
                    pair.setdefault("id", i + 1)
                    pair.setdefault("confidence", 75)
                    pair.setdefault("timestamp", "throughout video")
                    pair.setdefault("severity", "medium")
            
            # Add metadata
            analysis["video_id"] = req.video_id
            analysis["exercise"] = exercise_name
            analysis["muscle_group"] = muscle_group
            analysis["form_cues"] = form_cues
            analysis["common_mistakes"] = common_mistakes
            
            return analysis
        else:
            # Fallback: Create structured response from unstructured text
            print(f"JSON parse failed. Raw response: {feedback_text[:500]}")
            
            return {
                "video_id": req.video_id,
                "exercise": exercise_name,
                "muscle_group": muscle_group,
                "form_score": 6,
                "confidence": 50,
                "assessment": "AI provided feedback but format was unclear. Manual review of text below recommended.",
                "feedback_pairs": [{
                    "id": 1,
                    "body_part": "General Form",
                    "issue": "Analysis completed but structured data unavailable",
                    "correction": "Review raw AI response below",
                    "severity": "medium",
                    "risk": "See detailed feedback",
                    "confidence": 50,
                    "timestamp": "N/A"
                }],
                "strengths": ["Completed exercise attempt"],
                "next_steps": ["Review AI text feedback", "Consider re-recording with better angle"],
                "raw_feedback": feedback_text,
                "form_cues": form_cues,
                "common_mistakes": common_mistakes
            }
            
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            "video_id": req.video_id,
            "exercise": exercise_name,
            "error": str(e),
            "form_score": 0,
            "confidence": 0,
            "feedback_pairs": [],
        }

@app.post("/api/video/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(req: UploadUrlRequest):
    video_id = str(uuid.uuid4())
    upload_url = f"https://storage-service/upload/{video_id}/{req.filename}"
    return UploadUrlResponse(upload_url=upload_url, video_id=video_id)

@app.get("/")
async def root():
    return {"message": "FormPerfect API v2.0 - Enhanced Analysis"}
