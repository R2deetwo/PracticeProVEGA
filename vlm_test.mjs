import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

async function main() {
  const zai = await ZAI.create();
  
  const img1 = fs.readFileSync('/home/z/my-project/upload/pasted_image_1780932242753.png');
  const b64_1 = img1.toString('base64');
  
  const response = await zai.chat.completions.createVision({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this screenshot briefly. What app is this?' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${b64_1}` } }
        ]
      }
    ],
    thinking: { type: 'disabled' }
  });
  
  console.log(response.choices[0]?.message?.content);
}

main().catch(e => console.error(e.message));
