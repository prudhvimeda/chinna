'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import '@mediapipe/face_mesh'; // Required for MediaPipe runtime model loading

export function useVisualSpeech() {
  const [isMouthMoving, setIsMouthMoving] = useState(false);
  const [mouthAperture, setMouthAperture] = useState(0);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const detectorRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const requestRef = useRef<number>(0);

  const setupDetector = useCallback(async () => {
    try {
      await tf.ready();
      const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
      const detectorConfig: faceLandmarksDetection.MediaPipeFaceMeshTfjsModelConfig = {
        runtime: 'tfjs',
        refineLandmarks: true,
        maxFaces: 1,
      };
      detectorRef.current = await faceLandmarksDetection.createDetector(model, detectorConfig);
      setModelLoaded(true);
    } catch (err) {
      console.error('Face Mesh setup error:', err);
      setError('Failed to load Face Mesh model.');
    }
  }, []);

  const detect = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current) return;

    if (videoRef.current.readyState < 2) {
      requestRef.current = requestAnimationFrame(detect);
      return;
    }

    try {
      const faces = await detectorRef.current.estimateFaces(videoRef.current);
      
      if (faces.length > 0) {
        const keypoints = faces[0].keypoints;
        
        // Landmark 13 is Upper Inner Lip, 14 is Lower Inner Lip
        const lipTop = keypoints.find(kp => kp.name === 'lipTopInner' || (kp as any).index === 13);
        const lipBottom = keypoints.find(kp => kp.name === 'lipBottomInner' || (kp as any).index === 14);

        if (lipTop && lipBottom) {
             // Calculate Euclidean distance (2D) for simplicity
             const distance = Math.sqrt(
                Math.pow(lipTop.x - lipBottom.x, 2) + 
                Math.pow(lipTop.y - lipBottom.y, 2)
             );
             
             setMouthAperture(distance);
             
             // threshold of ~4-5 pixels for "open" (depends on camera distance)
             const threshold = 4.5; 
             const moving = distance > threshold;
             
             setIsMouthMoving(moving);
        }
      } else {
        setIsMouthMoving(false);
        setMouthAperture(0);
      }
    } catch (err) {
      console.error('Face Mesh frame error:', err);
    }

    requestRef.current = requestAnimationFrame(detect);
  }, []);

  useEffect(() => {
    setupDetector();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (detectorRef.current) detectorRef.current.dispose();
    };
  }, [setupDetector]);

  const startCamera = useCallback(async () => {
    if (videoRef.current && videoRef.current.srcObject) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
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
      setError('Camera access denied. Visual Voice disabled.');
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
