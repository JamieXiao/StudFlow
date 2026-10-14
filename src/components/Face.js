import {useEffect, useRef, useState} from 'react';
import {DrawingUtils, FaceLandmarker} from '@mediapipe/tasks-vision';
import { Button, FormControl, InputLabel, MenuItem, Select } from '@mui/material';

function Face() {
    // setup
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const workerRef = useRef(null);
    const [workerError, setWorkerError] = useState('');
    const [isReady, setIsReady] = useState(false);
    const animationRef = useRef(null);

    // face
    const faceGoneStartRef = useRef(null);
    const faceBackStartRef = useRef(null);
    const [faceInFrame, setfaceInFrame] = useState(false);
    const [gone, setGone] = useState(false);

    // eyes
    const eyesClosedStartRef = useRef(null);
    const eyesOpenStartRef = useRef(null);
    const [eyesClosed, setEyesClosed] = useState(false);
    const sleepThresholdRef = useRef(5000);
    const [sleep, setSleep] = useState(false);
    const [sleepThreshold, setSleepThreshold] = useState(5000);
    const [lock, setLock] = useState(false);

    // alarm
    const alarmRef = useRef(null);
    const [alarmType, setAlarmType] = useState('/alarm_sfx/alarm_clock.mp3');
    const alarmTypes = {
        'Alarm Clock': '/alarm_sfx/alarm_clock.mp3',
        'iPhone alarm' : '/alarm_sfx/iphone_alarm.mp3'
    };
    
    // update threshold
    useEffect(() => {
        const getData = async () => {
            const res = await chrome.storage.local.get(["sleep_threshold", "alarm_sound"]);
            setSleepThreshold(res.sleep_threshold);
            setAlarmType(res.alarm_sound);
        }
        const handleDataChange = (changes, namespace) => {
            if (changes.sleep_threshold) {
                setSleepThreshold(changes.sleep_threshold.newValue);
            }
            if (changes.alarm_sound) setAlarmType(changes.alarm_sound.newValue);
        }

        getData();
        chrome.storage.onChanged.addListener(handleDataChange);

        return () => {chrome.storage.onChanged.removeListener(handleDataChange);}
    }, []);

    // update ref threshold
    useEffect(() => {
        sleepThresholdRef.current = sleepThreshold;
        console.log("Sleep threshold updated to: " + sleepThreshold);
    }, [sleepThreshold]);

    // set up alarm object
    useEffect(() => {
        const alarm = new Audio(chrome.runtime.getURL(alarmType));
        alarm.loop = true;
        alarmRef.current = alarm;
        console.log("Alarm updated to: " + alarmType);

        const handleMessage = (msg) => {
            if (msg.type === "alarm stopped") {
            alarmRef.current.pause();
            alarmRef.current.currentTime = 0;
            // alarmRef.current = null;
            setLock(false);
            }
        }

        chrome.runtime.onMessage.addListener(handleMessage);

        return () => { // cleamup
            alarm.pause();
            alarm.currentTime = 0;
            alarmRef.current = null;
            chrome.runtime.onMessage.removeListener(handleMessage);
        };
    }, [alarmType]);

    // play alarm sound when sleep detected
    useEffect(() => {
        const alarm = alarmRef.current;
        if (!alarm) return;
        
        if (sleep || gone) {
            // if (!math) setMath(true);
            if (!lock) {
                alarm.play().catch((error) => {
                    console.error("Error playing alarm sound:", error);
                });
                chrome.runtime.sendMessage({
                    type: "asleep"
                });
                setLock(true);
            }
        } 
    }, [sleep, gone]);

    // TESTING: dismiss alarm function
    // function dismissAlarm() {
    //     if (alarmRef.current) {
    //         alarmRef.current.pause();
    //         alarmRef.current.currentTime = 0;
    //         // alarmRef.current = null;
    //         setSleep(false);
    //         setLock(false);
    //     }
    // }

    // main effect for processing
    useEffect(() => {
        let stream = null; // webcam stream
        let canvasCtx = null;
        let drawingUtils = null;
        const captureCanvas = document.createElement('canvas');
        const captureCtx = captureCanvas.getContext('2d', {willReadFrequently: true});

        if (canvasRef.current) { // visible canvas display
            canvasCtx = canvasRef.current.getContext('2d');
            drawingUtils = new DrawingUtils(canvasCtx);
        }

        // initialize worker
        try {
            workerRef.current = new Worker('/workers/faceLandmarker.js'); // run in sep thread
            workerRef.current.postMessage({
                type: 'init',
                wasmPath: chrome.runtime.getURL("workers/"),
                modelPath: chrome.runtime.getURL("models/face_landmarker.task")
            });
        } catch (e) {
            console.error("Initialization error:", e);
        }
        
        console.log("Worker initialized:", workerRef.current);

        const handleFrames = () => {
            if (videoRef.current && videoRef.current.readyState >= 2 && captureCtx) { // 2: HAVE_CURRENT_DATA
            const width = videoRef.current.videoWidth;
            const height = videoRef.current.videoHeight;

            if (captureCanvas.width !== width && captureCanvas.height !== height) {
            captureCanvas.width = width;
            captureCanvas.height = height;
            }

            captureCtx.drawImage(videoRef.current, 0, 0, width, height); // draw video frame to offscreen canvas
            const imageData = captureCtx.getImageData(0, 0, width, height);

            // create and send ImageBitmap to worker for processing
            createImageBitmap(imageData).then((imageBitmap) => {
            if (workerRef.current) {
                workerRef.current.postMessage(
                {type: 'process', imageBitmap, timestamp: performance.now()},
                [imageBitmap] // transfer ownership of ImageBitmap to worker and main thread close
                );
            }
            });
        }
        animationRef.current = requestAnimationFrame(handleFrames); // callback loop for nxt frame
        };

        // handle worker msgs
        if (workerRef.current) {
            workerRef.current.onmessage = (event) => {
                const {type, results, faceDetected, eyesClosed} = event.data;

                if (type === 'ready') {
                    setIsReady(true);
                    handleFrames();
                } else if (type === 'error') {
                    console.error('Face tracker worker error:', event.data.message);
                    setWorkerError(event.data.message);
                } else if (type === 'results') {
                    // update state based on worker results
                    setfaceInFrame(faceDetected);
                    setEyesClosed(eyesClosed);

                    // gone detection logic
                    if (!faceDetected) {
                        if (!faceGoneStartRef.current) faceGoneStartRef.current = performance.now(); // just left
                        const closedDuration = performance.now() - faceGoneStartRef.current;
                        if (closedDuration > sleepThresholdRef.current) {
                            setGone(true);
                        }
                        faceBackStartRef.current = null; // reset back
                    } else {
                        if (!faceBackStartRef.current) faceBackStartRef.current = performance.now(); // just back
                        const openDuration = performance.now() - faceBackStartRef.current;
                        if (openDuration > 200) { // reset gone state after 200 ms of being back
                            faceGoneStartRef.current = null; // reset gone
                            setGone(false);
                        }
                    }

                    // sleep detection logic
                    if (eyesClosed) {
                        if (!eyesClosedStartRef.current) eyesClosedStartRef.current = performance.now(); // just closed
                        const closedDuration = performance.now() - eyesClosedStartRef.current;
                        if (closedDuration > sleepThresholdRef.current) {
                            setSleep(true);
                        }
                        eyesOpenStartRef.current = null; // reset open
                    } else {
                        if (!eyesOpenStartRef.current) eyesOpenStartRef.current = performance.now(); // just opened
                        const openDuration = performance.now() - eyesOpenStartRef.current;
                        if (openDuration > 500) { // reset sleep state after 500 ms of eyes open
                            eyesClosedStartRef.current = null; // reset close
                            setSleep(false);
                        }
                    }

                    // draw face contours and landmarkss
                    if (canvasCtx && results?.faceLandmarks) {
                    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                    canvasCtx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

                        for (const landmarks of results.faceLandmarks) {
                            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
                            color: '#ececec70',
                            lineWidth: 1,
                            });
                            // drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: '#FF3030' });
                            // drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: '#30FF30' });
                        }
                    }
                }
            }
            // handle worker errors
            workerRef.current.onerror = (event) => {
                console.error('Face tracker worker failed:', event.message);
                setWorkerError(event.message);
            };
        }

        const startWebcam = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480 }, 
                audio: false 
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
            } catch (err) {
                console.error("Camera access failed:", err);
            }
        }

        startWebcam();

        return () => { // cleanup on unmount
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (stream) stream.getTracks().forEach(track => track.stop());
            if (workerRef.current) workerRef.current.terminate();
        };
    }, []);

    return (
        <div style={{ padding: '0px', fontFamily: 'sans-serif', maxWidth: '640px', margin: '0 auto' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }} />
            {/* <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'scaleX(-1)', pointerEvents: 'none' }} /> */}

            {/* TESTING */}
            {/* <div style={{ marginTop: '15px', background: '#f5f5f5', padding: '15px', borderRadius: '6px' }}>
                <p><strong>Sleep threshold:</strong> {parseInt(sleepThreshold)/1000} seconds</p>
                <p><strong>Face Status:</strong> {String(faceInFrame)}</p>
                <p><strong>Eyes State:</strong> {faceInFrame ? (eyesClosed ? 'closed' : 'open') : 'no face'}</p>
                <p><strong>Sleep State:</strong> {sleep ? 'asleep' : 'awake'}</p>
                <p><strong>Sleep State:</strong> {gone ? 'away' : 'presnt'}</p>
            </div>

            <Button onClick={dismissAlarm} variant="contained" color="secondary" style={{ marginTop: '15px' }}>
                Dismiss Alarm
            </Button> */}

        </div>
    )
}

export default Face;