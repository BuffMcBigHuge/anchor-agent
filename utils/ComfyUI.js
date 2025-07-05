// comfy.js
// A simple web wrapper around the ComfyUI API.

const WebSocket = require('ws');
const crypto = require('node:crypto');
const url = require('node:url');

// const Sentry = require('../vendors/sentry');

class ComfyUI {
  constructor({ 
    comfyUIServerURL, 
    nodes, 
    onSaveCallback, 
    onMessageCallback,
    onOpenCallback,
  }) {
    console.log(nodes);

    // Init
    this.comfyUI = null;
    this.clientId = crypto.randomUUID();
    this.nodes = nodes;
    this.queueRemaining = 0;
    this.imageURL = null;
    this.comfyUIServerURL = comfyUIServerURL;
    this.promptId = -1;

    if (onSaveCallback) {
      this.onSaveCallback = onSaveCallback;
    }

    if (onMessageCallback) {
      this.onMessageCallback = onMessageCallback;
    }

    if (onOpenCallback) {
      this.onOpenCallback = onOpenCallback;
    }

    // Connect
    this.connect();
  }
  
  connect() {
    console.log(`Connecting to ComfyUI server ${this.comfyUIServerURL}...`);
    const socketURL = `${this.comfyUIServerURL.replace('https://', 'wss://')}/ws?clientId=${this.clientId}`;
  
    this.comfyUI = new WebSocket(socketURL);

    // Connect
    this.comfyUI.onopen = (data) => {
      console.log('ComfyUI server opened.');

      // Let's assume this runs once (what happens if it disconnects and reconnects?)
      if (this.onOpenCallback) {
        this.onOpenCallback(this);
      }
    };
  
    // Disconnect
    this.comfyUI.onclose = (data) => {
      console.log(`ComfyUI server closed: ${data.toString()}`);
    };

    // Message
    this.comfyUI.onmessage = async (event) => {
      // Send Image Websocket Method      
      if (event.data instanceof Buffer) { // Changed from Blob check        
        // Handle binary data directly using Buffer
        /*
        const arrayBuffer = event.data;
        const dataView = new DataView(arrayBuffer.buffer);
        const event = dataView.getUint32(0);
        const format = dataView.getUint32(4);

        if (event === 1) {
          let imageData = arrayBuffer.slice(8);  // Extract image data
          let mimeType = format === 1 ? 'image/jpeg' : 'image/png';

          if (this.onSaveCallback) {
            this.onSaveCallback({ 
              buffer: imageData, 
              mimeType, 
              promptId: this.promptId 
            });
          }
        }
        */
      } else {
        try {
          const message = JSON.parse(event.data);

          if (!['crystools.monitor', 'progress'].includes(message.type)) {
            // console.log('Web Socket:', message);
          }
  
          if (message.type === 'status') {
            this.queueRemaining = message.data.status.exec_info.queue_remaining;
            // End of queue
            if (this.queueRemaining === 0) {
              // Not sure if this is needed
            }
          }

          if (message.data?.prompt_id && message.data.prompt_id === this.promptId) {
            // Queue Callback

            // Execution Started
            if (message.type === 'execution_start') {
              console.log('Execution Started', message);
            }
    
            // Execution Error
            if (message.type === 'execution_error') {
              console.error('Execution Error', message);
              // Sentry.captureException('Execution Error', {
              //   extra: {
              //     message,
              //     promptId: this.promptId,
              //   },
              // });
            }

            // Executed
            if (message.type === 'executed') {
              console.log('Executed:', message);

              // Save Callback
              if (this.nodes.api_save.includes(message.data.node)) {
                console.log(`Saving File: ${message.data.prompt_id}`);
  
                // Method: Triggers when node matches "api_save" in the nodes object, 
                // usually a PreviewImage, or VHS_VideoCombine
                if (this.onSaveCallback) {
                  this.onSaveCallback({ message, promptId: this.promptId });
                }
              }
            }

            // Executed Complete
            if (message.type === 'execution_success') {
              console.log('Executed Complete:', message);
            }

            if (message.type === 'status' && message.data?.status?.exec_info?.queue_remaining === 0) {
              // Empty Queue
              console.log('Empty Queue');
            }

            // Message Callback
            if ([
              'executed',
              'execution_start',
              'execution_cache',
              'execution_error',
              'execution_success',
            ].includes(message.type)) {
              if (this.onMessageCallback) {
                this.onMessageCallback({ message, promptId: this.promptId });
              }
            }
          }
        } catch (err) {
          console.error('Unknown message:', event.data);
          console.error(err);
        }
      }
    };
  
    // Error
    this.comfyUI.onerror = (err) => {
      console.error(err);
      console.error(`Websocket Error with Client ${this.clientId}`);
  
      // Close Websocket
      this.disconnect();
    };
  }

  disconnect() {
    this.comfyUI.close();
    console.log('Disconnected from ComfyUI server.');
  }

  queue({ workflowDataAPI }) {
    return new Promise(async (resolve, reject) => {
      try {
        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: workflowDataAPI,
            client_id: this.clientId,
          }),
        };

        const response = await fetch(`${this.comfyUIServerURL}/prompt`, options);
        if (!response.ok) {
          throw new Error(`Server responded with status ${response.status}`);
        }
        const responseData = await response.json();

        // Set Prompt ID
        if (responseData.prompt_id) {
          this.promptId = responseData.prompt_id;
        }

        // Print all the node errors
        if (responseData.node_errors && Object.keys(responseData.node_errors).length > 0) {
          for (const [nodeId, nodeError] of Object.entries(responseData.node_errors)) {
            console.error(`Node ${nodeId} (${nodeError.class_type}):`);
            if (Array.isArray(nodeError.errors)) {
              nodeError.errors.forEach((error, index) => {
                console.error(`  Error ${index + 1}: ${JSON.stringify(error)}`);
              });
            }
            if (nodeError.dependent_outputs?.length > 0) {
              console.error('  Affected outputs:', nodeError.dependent_outputs);
            }
          }
          // Sentry.captureException('ComfyUI Workflow Errors', {
          //   extra: {
          //     promptId: this.promptId,
          //     requestId: this.requestId,
          //     clientId: this.clientId,
          //     workflowDataAPI,
          //     response: responseData,
          //   },
          // });
        }

        // Check if any dependent_outputs include the nodes.api_save string value
        const saveNodeAffected = Object.values(responseData.node_errors).some((nodeError) => 
          nodeError.dependent_outputs?.some((output) => this.nodes.api_save.includes(output))
        );

        if (saveNodeAffected) {
          // Cancel the request
          console.error('Save node affected by errors.');
          this.interupt();
          reject(new Error('Save node affected by errors.'));
        } else {
          console.log(responseData);
          resolve(responseData);
        }
      } catch (err) {
        // Sentry.captureException(err);
        console.error(err);
        reject(err);
      }
    });
  }

  interupt() {
    return new Promise(async (resolve, reject) => {
      try {
        // TODO: Does this ONLY remove the prompt from the queue?
        //       What if the prompt is already running?

        const response = await fetch(`${this.comfyUIServerURL}/api/interrupt`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: this.clientId,
            prompt_id: this.promptId,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server responded with status ${response.status}`);
        }
        resolve();
      } catch (err) {
        // Sentry.captureException(err);
        console.error(err);
        reject(err);
      }
    });
  }

  getFile({ filename, subfolder, type }) {
    return new Promise(async (resolve, reject) => {
      try {
        const data = {
          filename,
          subfolder,
          type,
        };

        const urlString = `${this.comfyUIServerURL}/view?${new url.URLSearchParams(data)}`;

        console.log(`Retrieving File ${urlString}.`);

        const response = await fetch(urlString);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Failed to retrieve file from ComfyUI with status ${response.status}:`, errorText);
          throw new Error(`Server responded with status ${response.status}: ${errorText}`);
        }

        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');
        console.log(`📄 File response - Content-Type: ${contentType}, Content-Length: ${contentLength} bytes`);

        const arrayBuffer = await response.arrayBuffer();
        console.log(`✅ File retrieved successfully, size: ${arrayBuffer.byteLength} bytes`);
        
        // Validate that we received some data
        if (arrayBuffer.byteLength === 0) {
          throw new Error('Received empty file from ComfyUI');
        }

        resolve(arrayBuffer);

      } catch (err) {
        console.error(`❌ Error retrieving file from ComfyUI:`, err);
        reject(err);
      }
    });
  }

  uploadFile({ fileBuffer, filename, subfolder = '', overwrite = false }) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`Uploading File ${filename} to ComfyUI...`);

        const formData = new FormData();
        const blob = new Blob([fileBuffer]);
        formData.append('image', blob, filename);
        
        if (subfolder) {
          formData.append('subfolder', subfolder);
        }
        
        if (overwrite) {
          formData.append('overwrite', 'true');
        }

        const response = await fetch(`${this.comfyUIServerURL}/upload/image`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Server responded with status ${response.status}`);
        }

        const responseData = await response.json();
        console.log(`✅ File uploaded successfully: ${filename}`);
        resolve(responseData);

      } catch (err) {
        console.error(`❌ File upload failed: ${filename}`, err);
        reject(err);
      }
    });
  }

  uploadAudio({ audioBuffer, filename, subfolder = '' }) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`Uploading Audio ${filename} to ComfyUI...`);

        const formData = new FormData();
        const blob = new Blob([audioBuffer], { type: 'audio/wav' });
        formData.append('image', blob, filename); // ComfyUI uses 'image' field for all file uploads
        
        // Only add subfolder if it's not empty (audio files typically go to root input directory)
        if (subfolder && subfolder.trim() !== '') {
          formData.append('subfolder', subfolder);
        }

        const response = await fetch(`${this.comfyUIServerURL}/upload/image`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ ComfyUI audio upload failed with status ${response.status}:`, errorText);
          throw new Error(`Server responded with status ${response.status}: ${errorText}`);
        }

        const responseData = await response.json();
        console.log(`✅ Audio uploaded successfully: ${filename}`);
        console.log('📋 Upload response data:', JSON.stringify(responseData, null, 2));
        
        // Validate that the upload response contains the expected structure
        if (responseData && responseData.name) {
          console.log(`📁 File uploaded as: ${responseData.name}`);
          console.log(`📂 Subfolder: ${responseData.subfolder || 'root'}`);
        }
        
        resolve(responseData);

      } catch (err) {
        console.error(`❌ Audio upload failed: ${filename}`, err);
        reject(err);
      }
    });
  }

  uploadImage({ imageBuffer, filename, subfolder = '' }) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`Uploading Image ${filename} to ComfyUI...`);

        const formData = new FormData();
        const blob = new Blob([imageBuffer], { type: 'image/png' });
        formData.append('image', blob, filename);
        
        // Only add subfolder if it's not empty (images typically go to root input directory)
        if (subfolder && subfolder.trim() !== '') {
          formData.append('subfolder', subfolder);
        }

        const response = await fetch(`${this.comfyUIServerURL}/upload/image`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ ComfyUI image upload failed with status ${response.status}:`, errorText);
          throw new Error(`Server responded with status ${response.status}: ${errorText}`);
        }

        const responseData = await response.json();
        console.log(`✅ Image uploaded successfully: ${filename}`);
        console.log('📋 Upload response data:', JSON.stringify(responseData, null, 2));
        
        // Validate that the upload response contains the expected structure
        if (responseData && responseData.name) {
          console.log(`📁 File uploaded as: ${responseData.name}`);
          console.log(`📂 Subfolder: ${responseData.subfolder || 'root'}`);
        }
        
        resolve(responseData);

      } catch (err) {
        console.error(`❌ Image upload failed: ${filename}`, err);
        reject(err);
      }
    });
  }
}

module.exports = ComfyUI;

// EOF
