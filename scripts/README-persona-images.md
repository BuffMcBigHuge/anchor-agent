# Persona Image Generation

This script generates images for each persona using ComfyUI and uploads them to S3.

## Prerequisites

1. **ComfyUI Server**: Ensure ComfyUI is running and accessible
2. **AWS Credentials**: Set up AWS credentials for S3 access
3. **Dependencies**: Install required Node.js packages

## Environment Variables

Create a `.env.development` file with the following variables:

```env
# ComfyUI Configuration
COMFY_UI_SERVER_URL=http://localhost:8188

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key

# Other required variables
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Installation

Install the required dependencies:

```bash
npm install
```

## Usage

### Generate Images for All Personas

```bash
npm run generate:persona-images
```

This will:
1. Load all personas from `configs/personas.json`
2. Generate an image for each persona using ComfyUI
3. Save images locally in `output/images/` directory
4. Upload images to S3 in the `personas/` folder
5. Update the personas JSON file with S3 image URLs
6. Create a backup of the original personas file

### Test with Single Persona

```bash
npm run test:persona-images
```

This will generate an image for the first persona only, useful for testing.

### List Generated Images

```bash
npm run list:persona-images
```

This will show all generated persona images in the local directory with details like file size, creation date, and file paths.

### Sync to Database

After generating images, sync the updated personas to the database:

```bash
npm run sync:personas
```

## How It Works

1. **Load Configuration**: Reads personas from `configs/personas.json` and workflow from `workflows/t2i-flux-api.json`

2. **Generate Images**: For each persona:
   - Creates a prompt: `"an upper body view of a canadian news anchor in a studio looking at camera reporting top stories, hands on the table infront. The look of the news anchor {PERSONA_DESCRIPTION}"`
   - Sends the workflow to ComfyUI
   - Waits for image generation to complete

3. **Save Images**: 
   - Converts images to WebP format for optimization
   - Saves locally in `output/images/` directory
   - Uploads to S3 with filename format: `{sanitized-persona-name}-{uuid}.webp`
   - Stores in S3 `personas/` folder

4. **Update Configuration**: Updates the personas JSON file with the S3 image URLs

## File Structure

```
scripts/
├── generate-persona-images.js     # Main generation script
├── test-persona-image-generation.js  # Test script
├── list-persona-images.js         # List generated images utility
└── README-persona-images.md       # This documentation

configs/
└── personas.json                  # Persona configuration (updated with image URLs)

workflows/
└── t2i-flux-api.json             # ComfyUI workflow template

output/
└── images/                        # Generated images saved locally
    ├── silas-salty-okeefe-uuid.webp
    ├── dr-isabelle-dubois-uuid.webp
    └── ...
```

## Troubleshooting

### ComfyUI Connection Issues
- Ensure ComfyUI is running on the specified URL
- Check that the workflow file exists and is valid
- Verify ComfyUI has the required models loaded

### S3 Upload Issues
- Verify AWS credentials are correct
- Check S3 bucket permissions
- Ensure the bucket exists and is accessible

### Image Generation Issues
- Check ComfyUI logs for errors
- Verify the workflow nodes are compatible
- Ensure sufficient system resources (GPU memory)

## Script Options

The script includes several safety features:
- **Timeout Protection**: 5-minute timeout per image generation
- **Error Handling**: Continues processing other personas if one fails
- **Backup Creation**: Creates backup of original personas file
- **Skip Existing**: Won't regenerate images for personas that already have image URLs
- **Progress Tracking**: Shows detailed progress and statistics
- **Local Backup**: Always saves images locally before uploading to S3
- **Dual Storage**: Images are stored both locally and in S3 for redundancy

## Output

The script will update each persona object with an `imageUrl` field:

```json
{
  "name": "Silas 'Salty' O'Keefe",
  "description": "A retired fisherman...",
  "tone": "A low, rumbling drawl...",
  "voiceName": "charon",
  "imageUrl": "https://audio-chat-bymarco.s3.us-east-1.amazonaws.com/personas/silas-salty-okeefe-uuid.webp"
}
``` 