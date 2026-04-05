'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import * as faceDetection from '@tensorflow-models/face-detection';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';

export function useCameraPresence() {
  const [isUserDetected, setIsUserDetected] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const detectorRef = useRef<faceDetection.FaceDetector | null>(null);
  const requestRef = useRef<number>(0);

  const setupDetector = useCallback(async () => {
    try {
      await tf.ready();
      const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
      const detectorConfig: faceDetection.MediaPipeFaceDetectorTfjsModelConfig = {
        runtime: 'tfjs',
        maxFaces: 1,
        modelType: 'short', // 'short' is better for close-up range (front of computer)
      };
      detectorRef.current = await faceDetection.createDetector(model, detectorConfig);
      setModelLoaded(true);
    } catch (err) {
      console.error('Face detector setup error:', err);
      setError('Failed to load face detection model.');
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
      
      // Face is detected if we have at least one face in the frame
      const detected = faces.length > 0;
      
      // Implement a slight "debounce" or "smoothing" so it doesn't flicker
      setIsUserDetected(prev => {
        if (detected !== prev) {
           return detected;
        }
        return prev;
      });
    } catch (err) {
      console.error('Face detection frame error:', err);
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
      setError('Camera access denied. Visual awareness disabled.');
    }
  }, [detect]);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    setIsUserDetected(false);
  }, []);

  return {
    isUserDetected,
    modelLoaded,
    error,
    videoRef,
    startCamera,
    stopCamera,
  };
}
