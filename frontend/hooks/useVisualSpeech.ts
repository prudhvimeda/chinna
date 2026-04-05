'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export function useVisualSpeech() {
  const [isMouthMoving, setIsMouthMoving] = useState(false);
  const [mouthAperture, setMouthAperture] = useState(0);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const requestRef = useRef<number>(0);

  const setupDetector = useCallback(async () => {
    try {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      landmarkerRef.current = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      setModelLoaded(true);
      console.log('✅ Face Landmarker loaded successfully.');
    } catch (err) {
      console.error('Face Mesh setup error:', err);
      setError('Failed to load Face Mesh model.');
    }
  }, []);

  const detect = useCallback(async () => {
    if (!landmarkerRef.current || !videoRef.current) return;

    if (videoRef.current.readyState < 2) {
      requestRef.current = requestAnimationFrame(detect);
      return;
    }

    try {
      const startTimeMs = performance.now();
      const results = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
      
      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        
        // Landmark 13 is Upper Inner Lip, 14 is Lower Inner Lip
        const lipTop = landmarks[13];
        const lipBottom = landmarks[14];

        if (lipTop && lipBottom) {
             // Normalized coordinates (0.0 to 1.0)
             // Calculate Vertical distance
             const distance = Math.abs(lipTop.y - lipBottom.y);
             
             setMouthAperture(distance);
             
             // threshold of ~0.015-0.02 (normalized) for "open"
             const threshold = 0.018; 
             const moving = distance > threshold;
             
             if (moving !== isMouthMoving) {
                 setIsMouthMoving(moving);
                 // console.log(`👄 Mouth State: ${moving ? 'OPEN' : 'CLOSED'} (val: ${distance.toFixed(4)})`);
             }
        }
      } else {
        setIsMouthMoving(false);
        setMouthAperture(0);
      }
    } catch (err) {
      console.error('Face Mesh frame error:', err);
    }

    requestRef.current = requestAnimationFrame(detect);
  }, [isMouthMoving]);

  useEffect(() => {
    setupDetector();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (landmarkerRef.current) landmarkerRef.current.close();
    };
  }, [setupDetector]);

  const startCamera = useCallback(async () => {
    if (videoRef.current && videoRef.current.srcObject) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          detect();
        };
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Camera access denied.');
    }
  }, [detect]);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    setIsMouthMoving(false);
    setMouthAperture(0);
  }, []);

  return {
    isMouthMoving,
    mouthAperture,
    modelLoaded,
    error,
    videoRef,
    startCamera,
    stopCamera,
  };
}
