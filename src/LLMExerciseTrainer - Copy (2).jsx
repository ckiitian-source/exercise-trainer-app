import React, { useState, useRef, useEffect } from "react";

export default function FormPerfect() {
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const overlayCanvasRef = useRef(null);

  const [muscleGroup, setMuscleGroup] = useState("");
  const [exercises, setExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState("");
  const [exerciseDetails, setExerciseDetails] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [videoThumbnail, setVideoThumbnail] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoURL, setVideoURL] = useState(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [toast, setToast] = useState(null);

  const muscleGroups = [
    { name: "Chest", icon: "💪", color: "#FF6B6B" },
    { name: "Back", icon: "🔙", color: "#4ECDC4" },
    { name: "Legs", icon: "🦵", color: "#95E1D3" },
    { name: "Arms", icon: "💪", color: "#F38181" },
    { name: "Shoulders", icon: "🤷", color: "#AA96DA" },
    { name: "Core", icon: "⭕", color: "#FCBAD3" },
  ];

  const advertisements = [
    {
      title: "Premium Gym Equipment",
      description: "Professional-grade weights & machines for home and commercial use",
      cta: "Shop Now",
      logo: "🏋️",
      color: "#667eea",
    },
    {
      title: "Protein Supplements",
      description: "Fuel your gains with premium nutrition and recovery formulas",
      cta: "Get 20% Off",
      logo: "🥤",
      color: "#10b981",
    },
    {
      title: "Personal Training",
      description: "1-on-1 coaching from certified trainers available online",
      cta: "Book Session",
      logo: "👨‍🏫",
      color: "#f59e0b",
    },
    {
      title: "Fitness Apparel",
      description: "Performance wear designed for athletes and fitness enthusiasts",
      cta: "Shop Collection",
      logo: "👕",
      color: "#ec4899",
    },
  ];

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.code === "Space" && videoRef.current && !uploading) {
        e.preventDefault();
        if (videoRef.current.paused) {
          videoRef.current.play();
        } else {
          videoRef.current.pause();
        }
      }
      
      if (e.code === "KeyO" && analysis) {
        setShowOverlay(!showOverlay);
      }
      
      if (e.code.startsWith("Digit") && analysis?.feedback_pairs) {
        const num = parseInt(e.code.replace("Digit", "")) - 1;
        if (num >= 0 && num < analysis.feedback_pairs.length) {
          jumpToIssue(analysis.feedback_pairs[num], num);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [analysis, showOverlay, uploading]);

  useEffect(() => {
    if (!muscleGroup) {
      setExercises([]);
      setSelectedExercise("");
      setExerciseDetails(null);
      return;
    }

    fetch(`http://127.0.0.1:8000/api/exercises?muscle_group=${muscleGroup}`)
      .then((res) => res.json())
      .then((data) => {
        setExercises(data.exercises || []);
        setSelectedExercise("");
        setExerciseDetails(null);
      })
      .catch((err) => {
        setError("Failed to load exercises");
        showToast("Failed to load exercises", "error");
      });
  }, [muscleGroup]);

  useEffect(() => {
    if (!selectedExercise || !muscleGroup) return;

    fetch(
      `http://127.0.0.1:8000/api/exercise-details?muscle_group=${muscleGroup}&exercise_name=${selectedExercise}`
    )
      .then((res) => res.json())
      .then((data) => {
        setExerciseDetails(data);
      })
      .catch((err) => {
        setError("Failed to load exercise details");
        showToast("Failed to load exercise details", "error");
      });
  }, [selectedExercise, muscleGroup]);

  useEffect(() => {
    if (!videoRef.current || !overlayCanvasRef.current || !analysis) return;

    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext("2d");

    const drawOverlay = () => {
      if (!showOverlay) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      canvas.width = video.offsetWidth;
      canvas.height = video.offsetHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const currentTime = video.currentTime;

      drawScoreBadge(ctx, analysis.form_score);

      if (analysis.feedback_pairs && analysis.feedback_pairs.length > 0) {
        const duration = video.duration;
        const activeIssues = analysis.feedback_pairs.filter((pair, index) => {
          const isActive = isIssueActiveAtTime(pair.timestamp, currentTime, duration);
          return isActive || selectedIssue === index;
        });

        if (activeIssues.length > 0) {
          const issue = selectedIssue !== null 
            ? analysis.feedback_pairs[selectedIssue]
            : activeIssues[0];
          
          drawSingleLineText(ctx, issue, canvas.width, canvas.height);
        }
      }
    };

    const animationFrame = () => {
      drawOverlay();
      requestAnimationFrame(animationFrame);
    };

    const frameId = requestAnimationFrame(animationFrame);
    return () => cancelAnimationFrame(frameId);
  }, [analysis, showOverlay, selectedIssue, currentTime]);

  const drawScoreBadge = (ctx, score) => {
    ctx.save();
    const scoreColor = getScoreColor(score);
    const badgeX = 20;
    const badgeY = 20;
    const badgeWidth = 90;
    const badgeHeight = 60;

    const gradient = ctx.createLinearGradient(badgeX, badgeY, badgeX, badgeY + badgeHeight);
    gradient.addColorStop(0, scoreColor + "F0");
    gradient.addColorStop(1, scoreColor + "CC");
    ctx.fillStyle = gradient;
    
    roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font = "bold 28px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 8;
    ctx.fillText(
      `${score}/10`,
      badgeX + badgeWidth / 2,
      badgeY + badgeHeight / 2
    );
    ctx.restore();
  };

  const drawSingleLineText = (ctx, issue, width, height) => {
    ctx.save();

    const text = `⚠️ ${issue.body_part}: ${issue.issue}`;
    const maxWidth = width - 80;
    
    ctx.font = "bold 16px system-ui";
    let displayText = text;
    let textWidth = ctx.measureText(displayText).width;
    
    if (textWidth > maxWidth) {
      while (textWidth > maxWidth && displayText.length > 20) {
        displayText = displayText.slice(0, -4) + "...";
        textWidth = ctx.measureText(displayText).width;
      }
    }

    const textX = width / 2;
    const textY = height - 60;
    const padding = 16;
    const boxWidth = textWidth + padding * 2;
    const boxHeight = 50;

    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    roundRect(
      ctx,
      textX - boxWidth / 2,
      textY - boxHeight / 2,
      boxWidth,
      boxHeight,
      12
    );
    ctx.fill();

    ctx.strokeStyle = getSeverityColor(issue.severity);
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 4;
    ctx.fillText(displayText, textX, textY);

    ctx.restore();
  };

  const isIssueActiveAtTime = (timestamp, currentTime, duration) => {
    if (!timestamp || timestamp === "throughout video" || timestamp === "N/A") {
      return true;
    }

    const timeMatch = timestamp.match(/(\d+):(\d+)(?:-(\d+):(\d+))?/);
    if (!timeMatch) return true;

    const startMin = parseInt(timeMatch[1]);
    const startSec = parseInt(timeMatch[2]);
    const startTime = startMin * 60 + startSec;

    if (timeMatch[3] && timeMatch[4]) {
      const endMin = parseInt(timeMatch[3]);
      const endSec = parseInt(timeMatch[4]);
      const endTime = endMin * 60 + endSec;
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      return Math.abs(currentTime - startTime) < 3;
    }
  };

  const roundRect = (ctx, x, y, width, height, radius) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoURL(url);
      generateThumbnail(file);
      setAnalysis(null);
      setError(null);
      setSelectedIssue(null);
      showToast("Video uploaded successfully", "success");
    }
  };

  const generateThumbnail = (file) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = URL.createObjectURL(file);
    video.currentTime = 1;

    video.onloadeddata = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      setVideoThumbnail(canvas.toDataURL("image/png"));
      URL.revokeObjectURL(video.src);
    };
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result.split(",")[1];
        resolve(base64String);
      };
      reader.onerror = reject;
    });

  const analyzeVideo = async () => {
    if (!fileRef.current?.files?.[0]) {
      setError("Please upload a video first");
      showToast("Please upload a video first", "error");
      return;
    }

    if (!muscleGroup || !selectedExercise) {
      setError("Please select muscle group and exercise");
      showToast("Please select muscle group and exercise", "error");
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);
    setStatus("Encoding video...");

    try {
      const file = fileRef.current.files[0];
      
      setUploadProgress(30);
      const base64Video = await toBase64(file);

      setUploadProgress(60);
      setStatus("Sending to AI for analysis...");

      const response = await fetch("http://127.0.0.1:8000/api/video/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: Math.random().toString(36).substring(7),
          muscle_group: muscleGroup,
          exercise_name: selectedExercise,
          video_base64: base64Video,
        }),
      });

      setUploadProgress(90);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setUploadProgress(100);
      setAnalysis(result);
      setStatus("Analysis complete!");
      showToast("Analysis completed successfully!", "success");

      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setError("Analysis failed: " + err.message);
      showToast("Analysis failed: " + err.message, "error");
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const exportAnalysis = () => {
    if (!analysis) return;
    
    const data = {
      exercise: selectedExercise,
      muscleGroup: muscleGroup,
      score: analysis.form_score,
      confidence: analysis.confidence,
      issues: analysis.feedback_pairs,
      timestamp: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `form-analysis-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Analysis exported successfully", "success");
  };

  const jumpToIssue = (pair, index) => {
    if (!videoRef.current) return;
    
    const duration = videoRef.current.duration;
    const timestamp = parseTimestamp(pair.timestamp, duration);
    
    if (timestamp.start >= 0) {
      videoRef.current.currentTime = timestamp.start;
      setSelectedIssue(index);
      
      setTimeout(() => setSelectedIssue(null), 5000);
    }
  };

  const parseTimestamp = (timestamp, duration) => {
    if (!timestamp || timestamp === "throughout video" || timestamp === "N/A") {
      return { start: 0, end: duration };
    }

    const match = timestamp.match(/(\d+):(\d+)(?:-(\d+):(\d+))?/);
    if (!match) return { start: -1, end: -1 };

    const startMin = parseInt(match[1]);
    const startSec = parseInt(match[2]);
    const start = startMin * 60 + startSec;

    if (match[3] && match[4]) {
      const endMin = parseInt(match[3]);
      const endSec = parseInt(match[4]);
      const end = endMin * 60 + endSec;
      return { start, end };
    }

    return { start, end: start + 2 };
  };

  const getSeverityColor = (severity) => {
    const colors = {
      critical: "#dc2626",
      high: "#ea580c",
      medium: "#f59e0b",
      low: "#22c55e",
    };
    return colors[severity] || "#6b7280";
  };

  const getSeverityBadgeStyle = (severity) => {
    const styles = {
      critical: {
        background: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
        color: "#991b1b",
        border: "2px solid #dc2626",
      },
      high: {
        background: "linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)",
        color: "#9a3412",
        border: "2px solid #ea580c",
      },
      medium: {
        background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
        color: "#92400e",
        border: "2px solid #f59e0b",
      },
      low: {
        background: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
        color: "#065f46",
        border: "2px solid #22c55e",
      },
    };
    return styles[severity] || {
      background: "#f3f4f6",
      color: "#374151",
      border: "2px solid #9ca3af",
    };
  };

  const getScoreColor = (score) => {
    if (score >= 9) return "#22c55e";
    if (score >= 7) return "#84cc16";
    if (score >= 5) return "#f59e0b";
    if (score >= 3) return "#ea580c";
    return "#dc2626";
  };

  const getScoreLabel = (score) => {
    if (score >= 9) return "Excellent";
    if (score >= 7) return "Good";
    if (score >= 5) return "Fair";
    if (score >= 3) return "Needs Work";
    return "Poor";
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return "#22c55e";
    if (confidence >= 60) return "#f59e0b";
    return "#dc2626";
  };

  const Toast = () => {
    if (!toast) return null;

    return (
      <div
        style={{
          position: "fixed",
          top: "100px",
          right: "20px",
          padding: "1rem 1.5rem",
          background: toast.type === "success" ? "#10b981" : "#ef4444",
          color: "white",
          borderRadius: "12px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
          zIndex: 10000,
          animation: "slideInRight 0.3s ease-out",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          minWidth: "300px",
        }}
      >
        <span style={{ fontSize: "1.5rem" }}>
          {toast.type === "success" ? "✓" : "⚠️"}
        </span>
        <span style={{ fontWeight: "600", flex: 1 }}>{toast.message}</span>
        <button
          onClick={() => setToast(null)}
          style={{
            background: "none",
            border: "none",
            color: "white",
            cursor: "pointer",
            fontSize: "1.5rem",
            padding: 0,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    );
  };

  const AdCard = ({ ad }) => (
    <div
      style={{
        padding: "1rem",
        background: `linear-gradient(135deg, ${ad.color}15 0%, ${ad.color}08 100%)`,
        borderRadius: "12px",
        border: `2px solid ${ad.color}40`,
        cursor: "pointer",
        transition: "all 0.3s ease",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 8px 24px ${ad.color}40`;
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "6px",
          right: "6px",
          padding: "0.2rem 0.4rem",
          background: "rgba(255, 255, 255, 0.9)",
          borderRadius: "4px",
          fontSize: "0.6rem",
          fontWeight: "700",
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Ad
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: `linear-gradient(135deg, ${ad.color} 0%, ${ad.color}CC 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.5rem",
            flexShrink: 0,
            boxShadow: `0 4px 12px ${ad.color}60`,
          }}
        >
          {ad.logo}
        </div>

        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontSize: "0.85rem",
              fontWeight: "700",
              color: "white",
              marginBottom: "0.25rem",
              margin: 0,
            }}
          >
            {ad.title}
          </h3>
          <p
            style={{
              fontSize: "0.7rem",
              color: "rgba(255, 255, 255, 0.7)",
              margin: "0.25rem 0 0.5rem 0",
              lineHeight: "1.3",
            }}
          >
            {ad.description}
          </p>
          <button
            style={{
              padding: "0.4rem 0.8rem",
              background: ad.color,
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "0.7rem",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: `0 2px 8px ${ad.color}60`,
            }}
          >
            {ad.cta} →
          </button>
        </div>
      </div>
    </div>
  );

  // Improved Muscle Visualization
  const MuscleVisualization = ({ muscle }) => {
    const selectedMuscle = muscleGroups.find(m => m.name === muscle);
    if (!selectedMuscle) return null;

    return (
      <div
        style={{
          padding: "1.5rem",
          background: `linear-gradient(135deg, ${selectedMuscle.color}20 0%, ${selectedMuscle.color}10 100%)`,
          borderRadius: "12px",
          border: `2px solid ${selectedMuscle.color}60`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "4rem",
            marginBottom: "0.5rem",
          }}
        >
          {selectedMuscle.icon}
        </div>
        <div
          style={{
            fontSize: "1.2rem",
            fontWeight: "800",
            color: selectedMuscle.color,
            marginBottom: "0.5rem",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          {selectedMuscle.name}
        </div>
        <div
          style={{
            fontSize: "0.8rem",
            color: "rgba(255, 255, 255, 0.7)",
            fontWeight: "500",
          }}
        >
          Selected Muscle Group
        </div>
      </div>
    );
  };

  // Standalone Analytics Dashboard Component
  const AnalyticsDashboard = ({ analysis }) => {
    if (!analysis) return null;

    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const topIssues = [...analysis.feedback_pairs]
      .sort((a, b) => {
        const severityDiff = severityOrder[a.severity || "low"] - severityOrder[b.severity || "low"];
        if (severityDiff !== 0) return severityDiff;
        return (b.confidence || 0) - (a.confidence || 0);
      })
      .slice(0, 3);

    return (
      <div
        style={{
          maxWidth: "900px",
          margin: "1.5rem auto 0",
          padding: "1.5rem",
          background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
          borderRadius: "16px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
        }}
      >
        <h3
          style={{
            fontSize: "1.1rem",
            fontWeight: "700",
            marginBottom: "1.5rem",
            color: "white",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>📊</span> Quick Analysis
        </h3>

        {/* Ideal vs Actual */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              fontSize: "0.85rem",
              fontWeight: "600",
              color: "rgba(255, 255, 255, 0.7)",
              marginBottom: "1rem",
            }}
          >
            Form Quality
          </div>

          {/* Ideal Bar */}
          <div style={{ marginBottom: "0.75rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                marginBottom: "0.5rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "rgba(255, 255, 255, 0.6)",
                  minWidth: "50px",
                }}
              >
                Ideal
              </span>
              <div
                style={{
                  flex: 1,
                  height: "24px",
                  background: "#22c55e",
                  borderRadius: "6px",
                  position: "relative",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "0.85rem",
                    fontWeight: "700",
                    color: "white",
                  }}
                >
                  10
                </span>
              </div>
            </div>
          </div>

          {/* Actual Bar */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                marginBottom: "0.5rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "rgba(255, 255, 255, 0.6)",
                  minWidth: "50px",
                }}
              >
                Actual
              </span>
              <div
                style={{
                  flex: 1,
                  height: "24px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "6px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(analysis.form_score / 10) * 100}%`,
                    height: "100%",
                    background: getScoreColor(analysis.form_score),
                    borderRadius: "6px",
                    transition: "width 0.5s ease",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "0.85rem",
                    fontWeight: "700",
                    color: "white",
                  }}
                >
                  {analysis.form_score}
                </span>
              </div>
            </div>
            {10 - analysis.form_score > 0 && (
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "rgba(255, 255, 255, 0.5)",
                  marginLeft: "62px",
                }}
              >
                Gap: -{10 - analysis.form_score} points
              </div>
            )}
          </div>
        </div>

        {/* Top Issues */}
        <div>
          <div
            style={{
              fontSize: "0.85rem",
              fontWeight: "600",
              color: "rgba(255, 255, 255, 0.7)",
              marginBottom: "1rem",
            }}
          >
            Top Issues & Fixes
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {topIssues.map((issue, index) => (
              <div
                key={index}
                style={{
                  padding: "1rem",
                  background: "rgba(255, 255, 255, 0.05)",
                  borderRadius: "12px",
                  border: `2px solid ${getSeverityColor(issue.severity)}40`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: getSeverityColor(issue.severity),
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.9rem",
                      fontWeight: "800",
                      flexShrink: 0,
                    }}
                  >
                    {index + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: "700",
                        color: "white",
                        marginBottom: "0.25rem",
                      }}
                    >
                      {issue.body_part}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.25rem 0.6rem",
                        ...getSeverityBadgeStyle(issue.severity),
                        borderRadius: "12px",
                        display: "inline-block",
                        textTransform: "uppercase",
                        fontWeight: "700",
                      }}
                    >
                      {issue.severity}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "rgba(255, 255, 255, 0.8)",
                    lineHeight: "1.5",
                  }}
                >
                  ✓ {issue.correction}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        padding: "0",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <Toast />

      {analysis && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            left: "20px",
            padding: "0.75rem 1rem",
            background: "rgba(0, 0, 0, 0.8)",
            borderRadius: "8px",
            fontSize: "0.75rem",
            color: "rgba(255, 255, 255, 0.7)",
            zIndex: 100,
          }}
        >
          <kbd style={{ padding: "0.2rem 0.4rem", background: "rgba(255, 255, 255, 0.1)", borderRadius: "4px", marginRight: "0.5rem" }}>Space</kbd>
          Play/Pause
          <span style={{ margin: "0 0.5rem" }}>•</span>
          <kbd style={{ padding: "0.2rem 0.4rem", background: "rgba(255, 255, 255, 0.1)", borderRadius: "4px", marginRight: "0.5rem" }}>O</kbd>
          Toggle Overlay
        </div>
      )}

      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          padding: "2rem 0",
          position: "sticky",
          top: 0,
          zIndex: 100,
          backdropFilter: "blur(10px)",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
        }}
      >
        <div
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            padding: "0 2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "50px",
                height: "50px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.8rem",
                boxShadow: "0 8px 20px rgba(102, 126, 234, 0.4)",
              }}
            >
              💪
            </div>
            <div>
              <h1
                style={{
                  fontSize: "1.8rem",
                  fontWeight: "800",
                  color: "white",
                  margin: 0,
                  letterSpacing: "-0.5px",
                }}
              >
                FormPerfect
              </h1>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "rgba(255, 255, 255, 0.6)",
                  margin: 0,
                  fontWeight: "500",
                }}
              >
                AI-Powered Form Analysis
              </p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              background: "rgba(255, 255, 255, 0.05)",
              padding: "0.75rem 1.25rem",
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <div style={{ fontSize: "0.85rem", color: "rgba(255, 255, 255, 0.7)" }}>
              Powered by
            </div>
            <div
              style={{
                fontSize: "0.9rem",
                fontWeight: "700",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Gemini AI
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: "2rem" }}>
          
          {/* Left Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Muscle Group Selection */}
            <div
              style={{
                background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
                borderRadius: "16px",
                padding: "1.5rem",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    boxShadow: "0 0 20px rgba(102, 126, 234, 0.6)",
                  }}
                />
                <h2 style={{ fontSize: "1.2rem", fontWeight: "700", margin: 0, color: "white", letterSpacing: "-0.3px" }}>
                  Select Target Muscle
                </h2>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>
                {muscleGroups.map((group) => (
                  <button
                    key={group.name}
                    onClick={() => setMuscleGroup(group.name)}
                    style={{
                      padding: "1rem",
                      border: "2px solid",
                      borderColor: muscleGroup === group.name ? group.color : "rgba(255, 255, 255, 0.1)",
                      borderRadius: "12px",
                      background: muscleGroup === group.name
                        ? `linear-gradient(135deg, ${group.color}30 0%, ${group.color}20 100%)`
                        : "rgba(255, 255, 255, 0.03)",
                      color: muscleGroup === group.name ? group.color : "#94a3b8",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      fontSize: "0.95rem",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span style={{ fontSize: "1.5rem" }}>{group.icon}</span>
                    <span>{group.name}</span>
                  </button>
                ))}
              </div>

              {muscleGroup && (
                <div style={{ marginTop: "1.5rem" }}>
                  <MuscleVisualization muscle={muscleGroup} />
                </div>
              )}
            </div>

            {/* Consolidated Ads Section */}
            <div
              style={{
                background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
                borderRadius: "16px",
                padding: "1.5rem",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    boxShadow: "0 0 20px rgba(102, 126, 234, 0.6)",
                  }}
                />
                <h2 style={{ fontSize: "1.2rem", fontWeight: "700", margin: 0, color: "white", letterSpacing: "-0.3px" }}>
                  Featured Partners
                </h2>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {advertisements.map((ad, idx) => (
                  <AdCard key={idx} ad={ad} />
                ))}
              </div>
            </div>

            {exercises.length > 0 && (
              <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", boxShadow: "0 0 20px rgba(102, 126, 234, 0.6)" }} />
                  <h2 style={{ fontSize: "1.2rem", fontWeight: "700", margin: 0, color: "white", letterSpacing: "-0.3px" }}>Choose Exercise</h2>
                </div>

                <select
                  value={selectedExercise}
                  onChange={(e) => setSelectedExercise(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    border: "2px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    fontSize: "0.95rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    background: "rgba(255, 255, 255, 0.05)",
                    color: "white",
                    outline: "none",
                  }}
                >
                  <option value="" style={{ background: "#1e293b" }}>Select an exercise...</option>
                  {exercises.map((ex) => (
                    <option key={ex} value={ex} style={{ background: "#1e293b" }}>{ex}</option>
                  ))}
                </select>

                {exerciseDetails && (
                  <div style={{ marginTop: "1.5rem", padding: "1.25rem", background: "rgba(102, 126, 234, 0.1)", borderRadius: "12px", border: "2px solid rgba(102, 126, 234, 0.3)" }}>
                    <h3 style={{ fontWeight: "700", marginBottom: "1rem", fontSize: "1rem", color: "white", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span>📊</span>Recommended Protocol
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
                      {[
                        { label: "SETS", value: exerciseDetails.sets },
                        { label: "REPS", value: exerciseDetails.reps },
                        { label: "REST", value: exerciseDetails.rest },
                      ].map((item, idx) => (
                        <div key={idx} style={{ textAlign: "center", padding: "0.75rem", background: "rgba(255, 255, 255, 0.05)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                          <div style={{ fontSize: "1.5rem", fontWeight: "800", color: "#667eea", marginBottom: "0.25rem" }}>{item.value}</div>
                          <div style={{ fontSize: "0.7rem", color: "rgba(255, 255, 255, 0.5)", fontWeight: "700", letterSpacing: "0.5px" }}>{item.label}</div>
                        </div>
                      ))}
                    </div>

                    {exerciseDetails.form_cues && exerciseDetails.form_cues.length > 0 && (
                      <div style={{ marginBottom: "1rem", padding: "1rem", background: "rgba(34, 197, 94, 0.1)", borderRadius: "8px", border: "1px solid rgba(34, 197, 94, 0.2)" }}>
                        <h4 style={{ fontWeight: "700", fontSize: "0.85rem", marginBottom: "0.75rem", color: "#22c55e", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span>✓</span> Proper Form Cues
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.8rem", color: "rgba(255, 255, 255, 0.8)", lineHeight: "1.8" }}>
                          {exerciseDetails.form_cues.map((cue, idx) => (
                            <li key={idx}>{cue}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {exerciseDetails.common_mistakes && exerciseDetails.common_mistakes.length > 0 && (
                      <div style={{ padding: "1rem", background: "rgba(220, 38, 38, 0.1)", borderRadius: "8px", border: "1px solid rgba(220, 38, 38, 0.2)" }}>
                        <h4 style={{ fontWeight: "700", fontSize: "0.85rem", marginBottom: "0.75rem", color: "#dc2626", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span>✗</span> Avoid These Mistakes
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.8rem", color: "rgba(255, 255, 255, 0.8)", lineHeight: "1.8" }}>
                          {exerciseDetails.common_mistakes.map((mistake, idx) => (
                            <li key={idx}>{mistake}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedExercise && (
              <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", boxShadow: "0 0 20px rgba(102, 126, 234, 0.6)" }} />
                  <h2 style={{ fontSize: "1.2rem", fontWeight: "700", margin: 0, color: "white", letterSpacing: "-0.3px" }}>Upload Video</h2>
                </div>

                <input type="file" ref={fileRef} accept="video/*" onChange={handleFileChange} style={{ display: "none" }} />

                <button
                  onClick={() => fileRef.current?.click()}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    fontSize: "1rem",
                    fontWeight: "700",
                    cursor: "pointer",
                    marginBottom: "1rem",
                    boxShadow: "0 8px 20px rgba(102, 126, 234, 0.3)",
                    transition: "all 0.3s ease",
                  }}
                >
                  📹 Choose Video File
                </button>

                {videoThumbnail && (
                  <div style={{ marginBottom: "1rem", borderRadius: "12px", overflow: "hidden", border: "2px solid rgba(255, 255, 255, 0.1)", boxShadow: "0 8px 20px rgba(0, 0, 0, 0.3)" }}>
                    <img src={videoThumbnail} alt="Thumbnail" style={{ width: "100%", display: "block" }} />
                  </div>
                )}

                <button
                  onClick={analyzeVideo}
                  disabled={uploading || !fileRef.current?.files?.[0]}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    background: uploading || !fileRef.current?.files?.[0]
                      ? "rgba(100, 116, 139, 0.3)"
                      : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    fontSize: "1rem",
                    fontWeight: "700",
                    cursor: uploading || !fileRef.current?.files?.[0] ? "not-allowed" : "pointer",
                    boxShadow: uploading || !fileRef.current?.files?.[0] ? "none" : "0 8px 20px rgba(16, 185, 129, 0.3)",
                    transition: "all 0.3s ease",
                  }}
                >
                  {uploading ? "🔄 Analyzing..." : "🚀 Analyze Form"}
                </button>

                {uploading && uploadProgress > 0 && (
                  <div style={{ marginTop: "1rem", height: "4px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${uploadProgress}%`, background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)", transition: "width 0.3s ease" }} />
                  </div>
                )}

                {status && (
                  <div style={{ marginTop: "1rem", padding: "1rem", background: "rgba(59, 130, 246, 0.1)", color: "#60a5fa", borderRadius: "12px", fontSize: "0.9rem", fontWeight: "600", textAlign: "center", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
                    {status}
                  </div>
                )}

                {error && (
                  <div style={{ marginTop: "1rem", padding: "1rem", background: "rgba(220, 38, 38, 0.1)", color: "#f87171", borderRadius: "12px", fontSize: "0.9rem", fontWeight: "600", border: "1px solid rgba(220, 38, 38, 0.2)" }}>
                    ⚠️ {error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Main Content - Video at 900px + Dashboard Below */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {videoURL && (
              <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", boxShadow: "0 0 20px rgba(102, 126, 234, 0.6)" }} />
                    <h2 style={{ fontSize: "1.2rem", fontWeight: "700", margin: 0, color: "white", letterSpacing: "-0.3px" }}>Video Analysis</h2>
                  </div>

                  {analysis && (
                    <button
                      onClick={() => setShowOverlay(!showOverlay)}
                      style={{
                        padding: "0.5rem 1rem",
                        background: showOverlay ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "rgba(255, 255, 255, 0.05)",
                        color: "white",
                        border: showOverlay ? "none" : "2px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        fontWeight: "700",
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                      }}
                    >
                      {showOverlay ? "🔵 Hide" : "⚪ Show"} Overlay
                    </button>
                  )}
                </div>

                {/* Video at Fixed 900px */}
                <div style={{ 
                  maxWidth: "900px",
                  margin: "0 auto",
                  position: "relative"
                }}>
                  <video
                    ref={videoRef}
                    src={videoURL}
                    style={{ 
                      width: "100%", 
                      height: "auto",
                      borderRadius: "12px", 
                      display: "block", 
                      boxShadow: "0 12px 32px rgba(0, 0, 0, 0.4)" 
                    }}
                    controls
                    onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />

                  {analysis && (
                    <canvas
                      ref={overlayCanvasRef}
                      style={{ 
                        position: "absolute", 
                        top: 0, 
                        left: 0, 
                        width: "100%", 
                        height: "100%", 
                        pointerEvents: "none", 
                        borderRadius: "12px" 
                      }}
                    />
                  )}
                </div>

                {/* Analytics Dashboard Below Video */}
                {analysis && <AnalyticsDashboard analysis={analysis} />}

                {analysis && (
                  <div style={{ 
                    marginTop: "1rem", 
                    padding: "1rem", 
                    background: "rgba(102, 126, 234, 0.1)", 
                    borderRadius: "10px", 
                    fontSize: "0.85rem", 
                    color: "rgba(255, 255, 255, 0.7)", 
                    border: "1px solid rgba(102, 126, 234, 0.2)", 
                    maxWidth: "900px", 
                    margin: "1rem auto 0" 
                  }}>
                    💡 <strong style={{ color: "white" }}>Pro Tip:</strong> Issues shown on overlay. Dashboard shows quick analysis. Click cards below to jump to specific issues.
                  </div>
                )}
              </div>
            )}

            {analysis && (
              <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)", border: "1px solid rgba(255, 255, 255, 0.1)", animation: "fadeInUp 0.6s ease-out" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", boxShadow: "0 0 20px rgba(102, 126, 234, 0.6)" }} />
                    <h2 style={{ fontSize: "1.2rem", fontWeight: "700", margin: 0, color: "white", letterSpacing: "-0.3px" }}>Detailed Analysis</h2>
                  </div>

                  <button
                    onClick={exportAnalysis}
                    style={{
                      padding: "0.75rem 1.5rem",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "2px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "10px",
                      color: "white",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontSize: "0.9rem",
                      transition: "all 0.3s ease",
                    }}
                  >
                    <span>📥</span> Export Analysis
                  </button>
                </div>

                <div style={{ padding: "2rem", background: `linear-gradient(135deg, ${getScoreColor(analysis.form_score)}15 0%, ${getScoreColor(analysis.form_score)}08 100%)`, borderRadius: "16px", border: `3px solid ${getScoreColor(analysis.form_score)}40`, marginBottom: "1.5rem", textAlign: "center" }}>
                  <div style={{ fontSize: "5rem", fontWeight: "900", color: getScoreColor(analysis.form_score), lineHeight: 1, marginBottom: "0.5rem" }}>
                    {analysis.form_score}
                    <span style={{ fontSize: "2.5rem", opacity: 0.7 }}>/10</span>
                  </div>
                  <div style={{ fontSize: "1.4rem", fontWeight: "800", color: getScoreColor(analysis.form_score), marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "2px" }}>
                    {getScoreLabel(analysis.form_score)}
                  </div>

                  <div style={{ display: "flex", justifyContent: "center", gap: "2rem", marginTop: "1.5rem" }}>
                    <div style={{ padding: "0.75rem 1.5rem", background: "rgba(255, 255, 255, 0.05)", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                      <div style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.5)", marginBottom: "0.25rem", fontWeight: "600" }}>AI CONFIDENCE</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: "800", color: getConfidenceColor(analysis.confidence) }}>{analysis.confidence}%</div>
                    </div>

                    {analysis.rep_count && (
                      <div style={{ padding: "0.75rem 1.5rem", background: "rgba(255, 255, 255, 0.05)", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                        <div style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.5)", marginBottom: "0.25rem", fontWeight: "600" }}>REPS DETECTED</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "800", color: "#667eea" }}>{analysis.rep_count}</div>
                      </div>
                    )}
                  </div>
                </div>

                {analysis.feedback_pairs && analysis.feedback_pairs.length > 0 && (
                  <div style={{ marginTop: "1.5rem" }}>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: "700", marginBottom: "1rem", color: "white" }}>
                      All Issues ({analysis.feedback_pairs.length})
                    </h3>

                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {analysis.feedback_pairs.map((pair, idx) => {
                        const badgeStyle = getSeverityBadgeStyle(pair.severity);
                        return (
                          <div
                            key={idx}
                            style={{
                              padding: "1.5rem",
                              background: selectedIssue === idx ? "rgba(245, 158, 11, 0.15)" : "rgba(255, 255, 255, 0.03)",
                              border: `2px solid ${getSeverityColor(pair.severity)}40`,
                              borderRadius: "12px",
                              cursor: "pointer",
                              transition: "all 0.3s ease",
                            }}
                            onClick={() => jumpToIssue(pair, idx)}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", borderRadius: "50%", background: getSeverityColor(pair.severity), color: "white", fontWeight: "800", fontSize: "1rem" }}>
                                  {idx + 1}
                                </span>
                                <h4 style={{ fontSize: "1.1rem", fontWeight: "800", color: "white", margin: 0 }}>{pair.body_part}</h4>
                              </div>
                              <span style={{ fontSize: "0.75rem", padding: "0.4rem 0.9rem", ...badgeStyle, borderRadius: "20px", fontWeight: "800", textTransform: "uppercase" }}>
                                {pair.severity}
                              </span>
                            </div>

                            <div style={{ padding: "1rem", background: "rgba(220, 38, 38, 0.1)", borderRadius: "10px", marginBottom: "1rem" }}>
                              <div style={{ fontSize: "0.75rem", fontWeight: "800", color: "#f87171", marginBottom: "0.5rem" }}>⚠️ ISSUE</div>
                              <p style={{ margin: 0, color: "rgba(255, 255, 255, 0.9)", fontSize: "0.95rem", lineHeight: "1.6" }}>{pair.issue}</p>
                            </div>

                            <div style={{ padding: "1rem", background: "rgba(34, 197, 94, 0.1)", borderRadius: "10px" }}>
                              <div style={{ fontSize: "0.75rem", fontWeight: "800", color: "#4ade80", marginBottom: "0.5rem" }}>✓ FIX</div>
                              <p style={{ margin: 0, color: "rgba(255, 255, 255, 0.9)", fontSize: "0.95rem", lineHeight: "1.6" }}>{pair.correction}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background: #1e293b; }
        ::-webkit-scrollbar-thumb { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 5px; }
      `}</style>
    </div>
  );
}
