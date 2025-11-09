import React, { useState, useRef } from 'react';

export default function VideoUpload() {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [jobStatus, setJobStatus] = useState(null);
  const [result, setResult] = useState(null);

  const handleUpload = async () => {
    const file = fileRef.current.files[0];
    if (!file) return alert('Please select a video file.');

    setUploading(true);
    setJobStatus('Getting upload URL...');
    setResult(null);

    try {
      // 1) Request signed upload URL from backend
      const createRes = await fetch('http://127.0.0.1:8000/api/video/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, size_bytes: file.size, user_id: 'u123' }),
      });
      const createJson = await createRes.json();
      const uploadUrl = createJson.upload_url;
      const videoId = createJson.video_id;

      // 2) Upload file to signed URL (PUT)
      setJobStatus('Uploading video...');
      await fetch(uploadUrl, { method: 'PUT', body: file });

      // 3) Trigger backend to process uploaded video
      setJobStatus('Triggering video processing...');
      await fetch('http://127.0.0.1:8000/api/video/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId, muscle_group: 'Chest' }),
      });

      // 4) Poll backend for job status
      setJobStatus('Waiting for processing...');
      const poll = setInterval(async () => {
        const statusRes = await fetch(`http://127.0.0.1:8000/api/video/status?job_id=${videoId}`);
        const statusJson = await statusRes.json();
        setJobStatus(`Processing: ${statusJson.status}`);

        if (statusJson.status === 'done' || statusJson.status === 'failed') {
          clearInterval(poll);
          if (statusJson.status === 'done') {
            const resultRes = await fetch(`http://127.0.0.1:8000/api/video/result?video_id=${videoId}`);
            const resultJson = await resultRes.json();
            setResult(resultJson);
            setJobStatus('Processing complete.');
          } else {
            setJobStatus('Processing failed.');
          }
          setUploading(false);
        }
      }, 3000);

    } catch (error) {
      setUploading(false);
      setJobStatus(null);
      alert('Upload or processing failed: ' + error.message);
    }
  };

  return (
    <div className="bg-white p-6 rounded shadow mt-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">Upload Video for Form Evaluation</h2>
      <input ref={fileRef} type="file" accept="video/*" disabled={uploading} />
      <button
        onClick={handleUpload}
        disabled={uploading}
        className={`ml-4 px-4 py-2 rounded text-white ${
          uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
        }`}
      >
        {uploading ? 'Uploading...' : 'Upload & Process'}
      </button>
      <div className="mt-3 text-sm text-gray-600">Status: {jobStatus || 'Idle'}</div>

      {result && (
        <div className="mt-6 border rounded p-4 bg-gray-50">
          <h3 className="font-medium mb-2">Analysis Result (Summary)</h3>
          <pre className="text-xs whitespace-pre-wrap bg-white p-2 rounded border">{JSON.stringify(result.summary || result.llm_feedback || result, null, 2)}</pre>
          {result.visual_overlays?.frame_overlays_url && (
            <a
              href={result.visual_overlays.frame_overlays_url}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 underline mt-2 block"
            >
              Download video overlay
            </a>
          )}
        </div>
      )}
    </div>
  );
}
