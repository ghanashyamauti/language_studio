import { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { Camera, CheckCircle, AlertTriangle, RefreshCw, UserCheck, ShieldAlert, Clock } from 'lucide-react';

const FACEAPI_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js';
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

export default function HodFaceAttendance() {
  const [libLoaded, setLibLoaded] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [onLeave, setOnLeave] = useState(false);
  const [leaveInfo, setLeaveInfo] = useState(null);
  
  // Camera & Face states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [marking, setMarking] = useState(false);
  const [attendanceToday, setAttendanceToday] = useState(null);
  const [history, setHistory] = useState([]);
  
  const videoRef = useRef(null);

  // 1. Load face-api.js dynamically
  useEffect(() => {
    const loadScript = () => {
      if (window.faceapi) {
        setLibLoaded(true);
        return;
      }
      const script = document.createElement('script');
      script.src = FACEAPI_SCRIPT_URL;
      script.async = true;
      script.onload = () => setLibLoaded(true);
      script.onerror = () => toast.error('Failed to load face detection libraries. Check connection.');
      document.body.appendChild(script);
    };
    loadScript();
  }, []);

  // 2. Load face-api models once script is loaded
  useEffect(() => {
    if (!libLoaded) return;
    const loadModels = async () => {
      try {
        const faceapi = window.faceapi;
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        setModelsLoaded(true);
      } catch (err) {
        toast.error('Failed to load face detection neural models.');
      }
    };
    loadModels();
  }, [libLoaded]);

  // 3. Check statuses (registration, leave, today's attendance, recent history)
  const checkStatus = async () => {
    try {
      // Registration status
      const regRes = await api.get('/hod/face-status');
      setIsRegistered(regRes.data.registered);
      
      // Leave status today
      const leaveRes = await api.get('/leave/check-today');
      setOnLeave(leaveRes.data.on_leave);
      setLeaveInfo(leaveRes.data.leave);

      // Attendance history
      const historyRes = await api.get('/hod/my-attendance?limit=10');
      setHistory(historyRes.data.records || []);
      
      // Check if marked today
      const todayStr = new Date().toISOString().split('T')[0];
      const todayRecord = historyRes.data.records?.find((r) => r.date === todayStr);
      if (todayRecord) {
        setAttendanceToday(todayRecord);
      }
    } catch (err) {
      toast.error('Failed to load status details.');
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  // Camera helpers
  const startCamera = async () => {
    if (onLeave) {
      toast.error('Attendance marking blocked. You are on approved leave today.');
      return;
    }
    setIsCameraActive(true);
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (!isCameraActive) return;

    let activeStream = null;
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
        });
        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        toast.error('Could not access camera. Please allow webcam permissions.');
        setIsCameraActive(false);
      }
    };

    const timer = setTimeout(initCamera, 50);

    return () => {
      clearTimeout(timer);
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isCameraActive]);

  // Process capture & descriptor extraction
  const captureFaceDescriptor = async () => {
    if (!videoRef.current || !window.faceapi) {
      toast.error('Detection library not ready.');
      return null;
    }
    setDetecting(true);
    try {
      const faceapi = window.faceapi;
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
      const result = await faceapi
        .detectSingleFace(videoRef.current, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!result) {
        toast.error('No face detected. Center your face, look at the camera and ensure good lighting.');
        return null;
      }
      return Array.from(result.descriptor);
    } catch (err) {
      toast.error('Face detection failed: ' + err.message);
      return null;
    } finally {
      setDetecting(false);
    }
  };

  // Face Registration
  const handleRegister = async () => {
    const descriptor = await captureFaceDescriptor();
    if (!descriptor) return;

    setMarking(true);
    try {
      await api.post('/hod/face-register', { face_descriptor: descriptor });
      toast.success('Your face has been registered successfully!');
      setIsRegistered(true);
      stopCamera();
      checkStatus();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to register face data');
    } finally {
      setMarking(false);
    }
  };

  // Attendance Verification & Marking
  const handleMarkAttendance = async () => {
    const descriptor = await captureFaceDescriptor();
    if (!descriptor) return;

    setMarking(true);
    try {
      const res = await api.post('/hod/face-attendance', { face_descriptor: descriptor });
      toast.success('Attendance marked successfully!');
      setAttendanceToday({ date: res.data.date, check_in_time: res.data.time, status: 'Present' });
      stopCamera();
      checkStatus();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Verification failed. Try again.');
    } finally {
      setMarking(false);
    }
  };

  const statusReady = libLoaded && modelsLoaded;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-jspm-navy font-sans">Manager Face Attendance</h1>
        <p className="text-gray-500 text-sm">Verify your face via webcam to mark your daily attendance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Webcam & Control Panel */}
        <div className="lg:col-span-7 space-y-6">
          <div className="card flex flex-col items-center justify-center relative overflow-hidden min-h-[360px] bg-slate-900 border-none text-white">
            {isCameraActive ? (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                {detecting && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="animate-spin text-white" size={32} />
                      <div className="text-sm font-semibold">Analyzing face...</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-12 px-6 text-center">
                <Camera className="text-slate-600 animate-pulse" size={64} />
                <div>
                  <h3 className="font-bold text-lg">Webcam Inactive</h3>
                  <p className="text-slate-400 text-sm max-w-sm mt-1">
                    {!statusReady
                      ? 'Loading face detection libraries and models. Please wait...'
                      : onLeave
                      ? 'Attendance blocked because you are on approved leave today.'
                      : attendanceToday
                      ? 'You have already marked your attendance for today.'
                      : 'Activate the webcam to register or verify your face.'}
                  </p>
                </div>

                {statusReady && !onLeave && !attendanceToday && (
                  <button onClick={startCamera} className="btn-primary mt-2">
                    Start Camera
                  </button>
                )}
              </div>
            )}
            
            {/* Overlay Status Bar */}
            {!statusReady && (
              <div className="absolute top-4 left-4 right-4 bg-slate-800/90 text-xs px-3 py-2 rounded-lg border border-slate-700 flex items-center gap-2">
                <RefreshCw size={12} className="animate-spin text-blue-400" />
                <span>Loading face-api engine & models (TinyFace, Landmarks, Recognition)...</span>
              </div>
            )}
          </div>

          {/* Controls */}
          {isCameraActive && (
            <div className="flex justify-center gap-4">
              <button onClick={stopCamera} className="btn-secondary">
                Cancel / Turn Off
              </button>
              
              {!isRegistered ? (
                <button
                  onClick={handleRegister}
                  disabled={detecting || marking}
                  className="btn-primary bg-emerald-600 hover:bg-emerald-700"
                >
                  {marking ? 'Registering...' : 'Capture & Register Face'}
                </button>
              ) : (
                <button
                  onClick={handleMarkAttendance}
                  disabled={detecting || marking}
                  className="btn-primary bg-blue-600 hover:bg-blue-700"
                >
                  {marking ? 'Verifying...' : 'Verify & Mark Attendance'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Status & History */}
        <div className="lg:col-span-5 space-y-6">
          {/* Status Card */}
          <div className="card space-y-4">
            <h3 className="font-bold text-slate-800 text-base border-b border-gray-100 pb-2">Status overview</h3>

            {onLeave ? (
              <div className="p-3.5 bg-amber-50 border border-amber-100 text-amber-800 rounded-2xl flex items-start gap-3">
                <ShieldAlert className="flex-shrink-0 mt-0.5 text-amber-600" size={18} />
                <div>
                  <div className="font-bold text-sm">On Leave Today</div>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Your {leaveInfo?.leave_type || 'leave'} is approved for today ({leaveInfo?.start_date} to {leaveInfo?.end_date}). Attendance marking is disabled.
                  </p>
                </div>
              </div>
            ) : attendanceToday ? (
              <div className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl flex items-start gap-3">
                <CheckCircle className="flex-shrink-0 mt-0.5 text-emerald-600" size={18} />
                <div>
                  <div className="font-bold text-sm">Attendance Marked!</div>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Marked present today at <strong>{attendanceToday.check_in_time}</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-blue-50 border border-blue-100 text-blue-800 rounded-2xl flex items-start gap-3">
                <Clock className="flex-shrink-0 mt-0.5 text-blue-600" size={18} />
                <div>
                  <div className="font-bold text-sm">Pending Attendance</div>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Please mark your attendance for today using the webcam feed.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-50 p-3 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Registration Status</span>
                {isRegistered ? (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <UserCheck size={14} /> Registered
                  </span>
                ) : (
                  <span className="text-xs font-bold text-rose-500 flex items-center gap-1">
                    <AlertTriangle size={14} /> Unregistered
                  </span>
                )}
              </div>
              <div className="bg-slate-50 p-3 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Verification Mode</span>
                <span className="text-xs font-bold text-slate-700">Client Face-API</span>
              </div>
            </div>
          </div>

          {/* History Card */}
          <div className="card">
            <h3 className="font-bold text-slate-800 text-base border-b border-gray-100 pb-2 mb-3">Recent Attendance</h3>
            
            {history.length === 0 ? (
              <p className="text-center py-6 text-gray-400 text-sm">No recent attendance records.</p>
            ) : (
              <div className="space-y-3">
                {history.map((record) => (
                  <div key={record.id} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 last:border-none">
                    <div>
                      <div className="font-semibold text-slate-800">{record.date}</div>
                      <div className="text-[10px] text-gray-400 uppercase font-bold">{record.verified_by}</div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex px-2 py-0.5 bg-green-50 text-green-700 rounded-md font-semibold text-xs border border-green-100">
                        {record.status}
                      </span>
                      <div className="text-xs text-slate-500 mt-0.5">{record.check_in_time || 'N/A'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
