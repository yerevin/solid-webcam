import {
  JSX,
  createSignal,
  onMount,
  onCleanup,
  createEffect,
  mergeProps,
} from 'solid-js';
import { createStore } from 'solid-js/store';

// polyfill based on https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
(function polyfillGetUserMedia() {
  if (typeof window === 'undefined') {
    return;
  }

  // Older browsers might not implement mediaDevices at all, so we set an empty object first
  if (navigator.mediaDevices === undefined) {
    (navigator as any).mediaDevices = {};
  }

  // Some browsers partially implement mediaDevices. We can't just assign an object
  // with getUserMedia as it would overwrite existing properties.
  // Here, we will just add the getUserMedia property if it's missing.
  if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function (constraints) {
      // First get ahold of the legacy getUserMedia, if present
      const getUserMedia =
        // @ts-ignore
        navigator.getUserMedia ||
        // @ts-ignore
        navigator.webkitGetUserMedia ||
        // @ts-ignore
        navigator.mozGetUserMedia ||
        // @ts-ignore
        navigator.msGetUserMedia;

      // Some browsers just don't implement it - return a rejected promise with an error
      // to keep a consistent interface
      if (!getUserMedia) {
        return Promise.reject(
          new Error('getUserMedia is not implemented in this browser')
        );
      }

      // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
      return new Promise(function (resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    };
  }
})();

function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export type WebcamProps = JSX.VideoHTMLAttributes<HTMLVideoElement> & {
  audio: boolean;
  mirrored?: boolean;
  audioConstraints?: MediaStreamConstraints['audio'];
  videoConstraints?: MediaStreamConstraints['video'];
  onUserMedia?: (stream: MediaStream) => void;
  onUserMediaError?: (error: string | DOMException) => void;
};

const defaultProps = {
  audio: false,
  mirrored: false,
  onUserMedia: () => undefined,
  onUserMediaError: () => undefined,
} as const;

export type ScreenshotOptions = {
  minScreenshotHeight?: number;
  minScreenshotWidth?: number;
  forceScreenshotSourceSize?: boolean;
  imageSmoothing?: boolean;
  mirrored?: boolean;
  screenshotFormat?: 'image/webp' | 'image/png' | 'image/jpeg';
  screenshotQuality?: number;
  screenshotDimensions?: ScreenshotDimensions;
};

interface ScreenshotDimensions {
  width: number;
  height: number;
}

const defaultScreenshotOptions = {
  forceScreenshotSourceSize: false,
  imageSmoothing: true,
  mirrored: false,
  screenshotFormat: 'image/webp',
  screenshotQuality: 0.92,
} as const;

const [hasUserMedia, setHasUserMedia] = createSignal<boolean>(false);

export const getScreenshot = (
  videoRef: HTMLVideoElement,
  screenshotOptions: ScreenshotOptions = defaultScreenshotOptions
) => {
  if (!hasUserMedia()) return null;

  const canvas = getCanvas(videoRef, screenshotOptions);
  return (
    canvas &&
    canvas.toDataURL(
      screenshotOptions?.screenshotFormat,
      screenshotOptions?.screenshotQuality
    )
  );
};

const getCanvas = (
  videoRef: HTMLVideoElement,
  screenshotOptions: ScreenshotOptions = defaultScreenshotOptions
) => {
  if (!videoRef) return null;

  const mergedProps = {};
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;

  if (!hasUserMedia() || !videoRef.videoHeight) return null;

  if (!ctx) {
    let canvasWidth = videoRef.videoWidth;
    let canvasHeight = videoRef.videoHeight;
    if (!screenshotOptions.forceScreenshotSourceSize) {
      const aspectRatio = canvasWidth / canvasHeight;

      canvasWidth =
        screenshotOptions.minScreenshotWidth || videoRef.clientWidth;
      canvasHeight = canvasWidth / aspectRatio;

      if (
        screenshotOptions.minScreenshotHeight &&
        canvasHeight < screenshotOptions.minScreenshotHeight
      ) {
        canvasHeight = screenshotOptions.minScreenshotHeight;
        canvasWidth = canvasHeight * aspectRatio;
      }
    }

    canvas = document.createElement('canvas');
    canvas.width = screenshotOptions.screenshotDimensions?.width || canvasWidth;
    canvas.height =
      screenshotOptions.screenshotDimensions?.height || canvasHeight;
    ctx = canvas.getContext('2d');
  }

  if (ctx && canvas) {
    // mirror the screenshot
    if (screenshotOptions.mirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.imageSmoothingEnabled = screenshotOptions.imageSmoothing;
    ctx.drawImage(
      videoRef,
      0,
      0,
      screenshotOptions.screenshotDimensions?.width || canvas.width,
      screenshotOptions.screenshotDimensions?.height || canvas.height
    );

    // invert mirroring
    if (screenshotOptions.mirrored) {
      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0);
    }
  }

  return canvas;
};

export default function Webcam(props: WebcamProps) {
  const mergedProps = mergeProps(defaultProps, props);
  const [prevProps, setPrevProps] = createStore(mergedProps);

  let video: HTMLVideoElement | null = null;
  let stream: MediaStream | null = null;

  const [requestUserMediaId, setRequestUserMediaId] = createSignal<number>(0);
  const [unmounted, setUnmounted] = createSignal<boolean>(false);
  const [src, setSrc] = createSignal<string>('');

  onMount(() => {
    setUnmounted(false);

    if (!hasGetUserMedia()) {
      mergedProps.onUserMediaError('getUserMedia not supported');

      return;
    }

    if (!hasUserMedia()) {
      requestUserMedia();
    }

    if (mergedProps.children && typeof mergedProps.children != 'function') {
      console.warn('children must be a function');
    }
  });

  createEffect(() => {
    if (!hasGetUserMedia()) {
      mergedProps.onUserMediaError('getUserMedia not supported');

      return;
    }

    const audioConstraintsChanged =
      JSON.stringify(prevProps.audioConstraints) !==
      JSON.stringify(mergedProps.audioConstraints);
    const videoConstraintsChanged =
      JSON.stringify(prevProps.videoConstraints) !==
      JSON.stringify(mergedProps.videoConstraints);

    if (audioConstraintsChanged || videoConstraintsChanged) {
      stopAndCleanup();
      requestUserMedia();
    }
  });

  onCleanup(() => {
    setUnmounted(true);
    stopAndCleanup();
  });

  const stopMediaStream = (stream: MediaStream | null) => {
    if (stream) {
      if (stream.getVideoTracks && stream.getAudioTracks) {
        stream.getVideoTracks().map((track) => {
          stream.removeTrack(track);
          track.stop();
        });
        stream.getAudioTracks().map((track) => {
          stream.removeTrack(track);
          track.stop();
        });
      } else {
        (stream as unknown as MediaStreamTrack).stop();
      }
    }
  };

  const stopAndCleanup = () => {
    if (hasUserMedia()) {
      stopMediaStream(stream);

      if (src) {
        window.URL.revokeObjectURL(src());
      }
    }
  };

  const requestUserMedia = () => {
    const sourceSelected = (
      audioConstraints: boolean | MediaTrackConstraints | undefined,
      videoConstraints: boolean | MediaTrackConstraints | undefined
    ) => {
      const constraints: MediaStreamConstraints = {
        video:
          typeof videoConstraints !== 'undefined' ? videoConstraints : true,
      };

      if (mergedProps.audio) {
        constraints.audio =
          typeof audioConstraints !== 'undefined' ? audioConstraints : true;
      }

      setRequestUserMediaId((prev) => prev + 1);
      const myRequestUserMediaId = requestUserMediaId;

      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          if (unmounted() || myRequestUserMediaId !== requestUserMediaId) {
            stopMediaStream(stream);
          } else {
            handleUserMedia(null, stream);
          }
        })
        .catch((e) => {
          handleUserMedia(e);
        });
    };

    if ('mediaDevices' in navigator) {
      sourceSelected(
        mergedProps.audioConstraints,
        mergedProps.videoConstraints
      );
    } else {
      const optionalSource = (id: string | null) =>
        ({ optional: [{ sourceId: id }] } as MediaTrackConstraints);

      const constraintToSourceId = (constraint) => {
        const { deviceId } = constraint;

        if (typeof deviceId === 'string') {
          return deviceId;
        }

        if (Array.isArray(deviceId) && deviceId.length > 0) {
          return deviceId[0];
        }

        if (typeof deviceId === 'object' && deviceId.ideal) {
          return deviceId.ideal;
        }

        return null;
      };

      // @ts-ignore: deprecated api
      MediaStreamTrack.getSources((sources) => {
        let audioSource: string | null = null;
        let videoSource: string | null = null;

        sources.forEach((source: MediaStreamTrack) => {
          if (source.kind === 'audio') {
            audioSource = source.id;
          } else if (source.kind === 'video') {
            videoSource = source.id;
          }
        });

        const audioSourceId = constraintToSourceId(
          mergedProps.audioConstraints
        );
        if (audioSourceId) {
          audioSource = audioSourceId;
        }

        const videoSourceId = constraintToSourceId(
          mergedProps.videoConstraints
        );
        if (videoSourceId) {
          videoSource = videoSourceId;
        }

        sourceSelected(
          optionalSource(audioSource),
          optionalSource(videoSource)
        );
      });
    }
  };

  const handleUserMedia = (err, stream?: MediaStream) => {
    if (err || !stream) {
      setHasUserMedia(false);
      mergedProps.onUserMediaError(err);

      return;
    }

    stream = stream;

    try {
      if (video) {
        video.srcObject = stream;
      }
      setHasUserMedia(true);
    } catch (error) {
      setHasUserMedia(true);
      // @ts-ignore
      setSrc(window.URL.createObjectURL(stream));
    }

    mergedProps.onUserMedia(stream);
  };

  const videoStyle = mergedProps.mirrored
    ? {
        ...(mergedProps.style as JSX.CSSProperties),
        transform: `${
          (mergedProps.style as JSX.CSSProperties).transform || ''
        } scaleX(-1)`,
      }
    : mergedProps.style;

  return (
    <video
      autoplay
      playsinline
      src={src()}
      muted={!mergedProps.audio}
      ref={(ref) => {
        video = ref;
      }}
      style={videoStyle}
      {...mergedProps}
    />
  );
}
