
importScripts('./vision_bundle.js'); // api bundle

const {FaceLandmarker, FilesetResolver} = Vision; // props
let faceLandmarker = null;

const init = async (wasmPath, modelPath) => {
    try {
        // get runtime resrcs // wasm js
        // const visionPath = chrome.runtime.getURL("workers/");
        const filesetResolver = await FilesetResolver.forVisionTasks(wasmPath);

        faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, { 
            baseOptions: { // model/exec configs
                modelAssetPath: modelPath, // get task file loc
                delegate: "GPU" // faster processing
            },
            numFaces: 1, 
            runningMode: "VIDEO", // vid frames
            minFaceDetectionConfidence: 0.5, 
            minFacePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            outputFaceBlendshapes: true, // get scores
            outputFacialTransformationMatrixes: true // model matrices 
        });
        // send rdy msg to main thread
        self.postMessage({type: 'ready'}); 

    } catch (e) { 
        self.postMessage({type: 'error', message: e.message});
    }
}

// listener from main thread
self.onmessage = async (event) => { 
    const {type} = event.data;

    // error handling
    if (type === 'error') {
        console.error('Worker error:', event.data.message);
        return;
    }

    // tell worker to wake up and init
    if (type === 'init') {
        const {wasmPath, modelPath} = event.data;
        await init(wasmPath, modelPath);
    }

    // process frame from main thread
    if (type === 'process') {
        if (!faceLandmarker) {
            self.postMessage({type: 'error', message: 'FaceLandmarker is not initialized.'});
            return;
        }

        const {imageBitmap, timestamp} = event.data;
        try {
            const results = await faceLandmarker.detectForVideo(imageBitmap, timestamp);
            let faceDetected = false;
            let eyesClosed = false;

            if (results.faceLandmarks && results.faceLandmarks.length > 0) { // find face landmarks
                faceDetected = true;
                const blendshapes = results.faceBlendshapes?.[0]?.categories; // if can access blendshape categories if first face data exists

                if (blendshapes) { // blink
                    const leftEye = blendshapes.find(category => category.categoryName === 'eyeBlinkLeft')?.score || 0;
                    const rightEye = blendshapes.find(category => category.categoryName === 'eyeBlinkRight')?.score || 0;
                    eyesClosed = leftEye > 0.5 && rightEye > 0.5;
                }
            }
            // runs calcs on bg thread and sends back output to main thread for rendering
            self.postMessage({type: 'results', results, faceDetected, eyesClosed});
        } catch (e) {
            console.error('Error processing frame:', e);
            self.postMessage({type: 'error', message: e.message});
        } finally {
            imageBitmap.close(); // release the frame after process (free mem)
        }  
    }
};