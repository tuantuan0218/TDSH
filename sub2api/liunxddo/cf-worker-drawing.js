//本项目授权api_key，防止被恶意调用（填入到one-api/new-api的渠道密钥中）
const API_KEY = "sk-1234567890";

//https://sm.ms 图床key，可自行申请，为空则返回base64编码后的图片
const SMMS_API_KEY = 'xxxxxxxxx'; 
//cloudflare账号列表，每次请求都会随机从列表里取一个账号
const CF_ACCOUNT_LIST = [{
    account_id: "xxxxxxxxx",
    token: "xxxxxxxxx"
}];
//在你输入的prompt中添加 ---ntl可强制禁止提示词翻译、优化功能
//在你输入的prompt中添加 ---tl可强制开启提示词翻译、优化功能
//是否开启提示词翻译、优化功能
const CF_IS_TRANSLATE = true;
//示词翻译、优化模型
const CF_TRANSLATE_MODEL = "@cf/qwen/qwen1.5-14b-chat-awq";

const RATIO_MAP = {
    "1:1": "1024x1024",
    "1:2": "1024x2048",
    "3:2": "1536x1024",
    "4:3": "1536x2048",
    "16:9": "2048x1152",
    "9:16": "1152x2048"
}

//模型映射，设置客户端可用的模型。one-api，new-api在添加渠道时可使用“获取模型列表”功能，一键添加模型
const CUSTOMER_MODEL_MAP = {
    "test": {
        body: {
            model: "test"
        }
    },
    "FLUX.1": {
        isImage2Image: false,
        body: {
            model: "@cf/black-forest-labs/flux-1-schnell",
            prompt: "",
            width: 1024,
            height: 1024,
            num_steps: 8
        },
        RATIO_MAP: RATIO_MAP
    },
    "dreamshaper-8": {
        isImage2Image: false,
        body: {
            model: "@cf/lykon/dreamshaper-8-lcm",
            prompt: "",
            width: 1024,
            height: 1024,
            num_steps: 20
        },
        RATIO_MAP: RATIO_MAP
    },
    "stable-diffusion-xl-base": {
        isImage2Image: false,
        body: {
            model: "@cf/stabilityai/stable-diffusion-xl-base-1.0",
            prompt: "",
            width: 1024,
            height: 1024,
            num_steps: 20
        },
        RATIO_MAP: RATIO_MAP
    },
    "stable-diffusion-xl-lightning": {
        isImage2Image: false,
        body: {
            model: "@cf/bytedance/stable-diffusion-xl-lightning",
            prompt: "",
            width: 1024,
            height: 1024,
            num_steps: 20
        },
        RATIO_MAP: RATIO_MAP
    },
    "stable-diffusion-v1-5": {
        isImage2Image: true,
        body: {
            model: "@cf/runwayml/stable-diffusion-v1-5-inpainting",
            prompt: "",
            width: 1024,
            height: 1024,
            num_steps: 20
        },
        RATIO_MAP: RATIO_MAP
    },
    "stable-diffusion-v1-5-img2img": {
        isImage2Image: true,
        body: {
            model: "@cf/runwayml/stable-diffusion-v1-5-img2img",
            prompt: "",
            width: 1024,
            height: 1024,
            num_steps: 20
        },
        RATIO_MAP: RATIO_MAP
    }    
};

async function handleRequest(request) {
    try {
        if (request.method === "OPTIONS") {
            return getResponse("", 204);
        }

        const authHeader = request.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.split(" ")[1] !== API_KEY) {
            return getResponse("Unauthorized", 401);
        }

        if (request.url.endsWith("/v1/models")) {
            const arrs = [];
            Object.keys(CUSTOMER_MODEL_MAP).map(element => arrs.push({
                id: element,
                object: "model"
            }))
            const response = {
                data: arrs,
                success: true
            };
            return getResponse(JSON.stringify(response), 200);
        }

        if (request.method !== "POST") {
            return getResponse("Only POST requests are allowed", 405);
        }

        if (!request.url.endsWith("/v1/chat/completions")) {
            return getResponse("Not Found", 404);
        }

        const data = await request.json();
        const messages = data.messages || [];
        const modelInfo = CUSTOMER_MODEL_MAP[data.model] || CUSTOMER_MODEL_MAP["FLUX.1"];
        const stream = data.stream || false;
        const userMessage = messages.reverse().find((msg) => msg.role === "user")?.content;
        if (!userMessage) {
            return getResponse(JSON.stringify({
                error: "未找到用户消息"
            }), 400);
        }

        if (modelInfo.body.model == "test") {
            if (stream) {
                return handleStreamResponse(userMessage, "", "", data.model, "");
            } else {
                return handleNonStreamResponse(userMessage, "", "", data.model, "");
            }
        }

        const is_translate = extractTranslate(userMessage);
        const size = extractImageSize(userMessage, modelInfo.RATIO_MAP);
        const imageUrl = extractImageUrl(userMessage);
        const originalPrompt = cleanPromptString(userMessage);
        const translatedPrompt = is_translate ? await getPrompt(originalPrompt) : originalPrompt;

        let url;
        if (!imageUrl) {
            url = await generateImage(translatedPrompt, "", modelInfo, size);
        } else {
            const base64 = await convertImageToBase64(imageUrl);
            url = await generateImage(translatedPrompt, base64, modelInfo, size);
        }

        if (stream) {
            return handleStreamResponse(originalPrompt, translatedPrompt, size, data.model, url);
        } else {
            return handleNonStreamResponse(originalPrompt, translatedPrompt, size, data.model, url);
        }
    } catch (error) {
        return getResponse(JSON.stringify({
            error: `处理请求失败: ${error.message}`
        }), 500);
    }
}

async function generateImage(translatedPrompt, base64Image, modelInfo, imageSize) {
    try {
        const jsonBody = modelInfo.body; 
        jsonBody.prompt = translatedPrompt;
        jsonBody.width = parseInt(imageSize.split('x')[0]);
        jsonBody.height = parseInt(imageSize.split('x')[1]);

        if (modelInfo.isImage2Image && base64Image) {
            jsonBody.image = [...new Uint8Array(base64ToArrayBuffer(base64Image))];
            jsonBody.mask = [...new Uint8Array(base64ToArrayBuffer(base64Image))];
        }

        let requestBody={};

        for (let key in jsonBody) {
            if(key!="model"){
                requestBody[key]=jsonBody[key];
            }
        }

        const response = await postRequest(modelInfo.body.model, requestBody); 

        let image_blob;
        let image_b64
        try {
            const jsonResponse = await response.clone().json();
            if (jsonResponse && jsonResponse.success) {
                image_b64 = jsonResponse.result.image;
                image_blob = base64ToBlob(image_b64, "image/png");
            } else {
                return "生成图像失败，" + jsonResponse.errors[0]?.message;
            }
        } catch (error) {
            const arrayBuffer = await response.clone().arrayBuffer();
            image_b64 = arrayBufferToBase64(arrayBuffer);
            image_blob = new Blob([arrayBuffer], {
                type: "image/png"
            });
        }

        if (SMMS_API_KEY) {
            const imageUrl = await uploadImage(image_blob);
            return imageUrl;
        } else {
            return `data:image/webp;base64,${image_b64}`;
        }
    } catch (error) {
        return "图像生成或转换失败，请检查！" + error.message;
    }
}

async function uploadImage(imageBlob) {
    try {
        //const imageBlob = await response.blob();
        const formData = new FormData();
        formData.append("smfile", imageBlob, "image.jpg");
        const uploadResponse = await fetch("https://sm.ms/api/v2/upload", {
            method: 'POST',
            headers: {
                'Authorization': `${SMMS_API_KEY}`,
            },
            body: formData,
        });

        if (!uploadResponse.ok) {
            throw new Error("Failed to upload image");
        }

        const uploadResult = await uploadResponse.json();

        const imageUrl = uploadResult.data?.url;
        return imageUrl;
    } catch (error) {
        return "图像上传失败，请检查！" + error.message;
    }
}

async function convertImageToArrayBuffer(imageUrl) {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            //throw new Error('Failed to download image');
            return null;
        }

        return [...new Uint8Array(await response.arrayBuffer())]

    } catch (error) {
        return null;
    }
}

async function convertImageToBase64(imageUrl) {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            //throw new Error('Failed to download image');
            return "";
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64Image = arrayBufferToBase64(arrayBuffer);
        return base64Image;
        //return `data:image/webp;base64,${base64Image}`;
    } catch (error) {
        return "";
    }
}

function base64ToBlob(base64, mimeType = '') {
    let bstr = atob(base64),
        n = bstr.length,
        u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {
        type: mimeType
    });
}

function base64ToArrayBuffer(base64) {
    // 解码 base64
    let binaryString = atob(base64);

    // 创建 ArrayBuffer
    let len = binaryString.length;
    let bytes = new Uint8Array(len);

    // 将每个字符的 UTF-8 值转换为字节
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes.buffer; // 返回 ArrayBuffer
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function getPrompt(prompt) {
    const requestBodyJson = {
        messages: [{
                role: "system",
                content: `作为 Stable Diffusion Prompt 提示词专家，您将从关键词中创建提示，通常来自 Danbooru 等数据库。

        提示通常描述图像，使用常见词汇，按重要性排列，并用逗号分隔。避免使用"-"或"."，但可以接受空格和自然语言。避免词汇重复。

        为了强调关键词，请将其放在括号中以增加其权重。例如，"(flowers)"将'flowers'的权重增加1.1倍，而"(((flowers)))"将其增加1.331倍。使用"(flowers:1.5)"将'flowers'的权重增加1.5倍。只为重要的标签增加权重。

        提示包括三个部分：**前缀**（质量标签+风格词+效果器）+ **主题**（图像的主要焦点）+ **场景**（背景、环境）。

        *   前缀影响图像质量。像"masterpiece"、"best quality"、"4k"这样的标签可以提高图像的细节。像"illustration"、"lensflare"这样的风格词定义图像的风格。像"bestlighting"、"lensflare"、"depthoffield"这样的效果器会影响光照和深度。

        *   主题是图像的主要焦点，如角色或场景。对主题进行详细描述可以确保图像丰富而详细。增加主题的权重以增强其清晰度。对于角色，描述面部、头发、身体、服装、姿势等特征。

        *   场景描述环境。没有场景，图像的背景是平淡的，主题显得过大。某些主题本身包含场景（例如建筑物、风景）。像"花草草地"、"阳光"、"河流"这样的环境词可以丰富场景。你的任务是设计图像生成的提示。请按照以下步骤进行操作：

        1.  我会发送给您一个图像场景。需要你生成详细的图像描述
        2.  图像描述必须是英文，输出为Positive Prompt。

        示例：

        我发送：二战时期的护士。
        您回复只回复：
        A WWII-era nurse in a German uniform, holding a wine bottle and stethoscope, sitting at a table in white attire, with a table in the background, masterpiece, best quality, 4k, illustration style, best lighting, depth of field, detailed character, detailed environment.`
            },
            {
                role: "user",
                content: prompt
            }
        ]
    };

    const response = await postRequest(CF_TRANSLATE_MODEL, requestBodyJson);

    if (!response.ok) {
        return prompt;
    }

    const jsonResponse = await response.json();
    const res = jsonResponse.result.response;
    return res;
}

function getResponse(resp, status) {
    return new Response(resp, {
        status: status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*'
        }
    });
}

function handleStreamResponse(originalPrompt, translatedPrompt, size, model, imageUrl) {
    const uniqueId = `chatcmpl-${Date.now()}`;
    const createdTimestamp = Math.floor(Date.now() / 1000);
    const systemFingerprint = "fp_" + Math.random().toString(36).substr(2, 9);
    const content = `🎨 原始提示词：${originalPrompt}\n` +
        `🌐 翻译后的提示词：${translatedPrompt}\n` +
        `📐 图像规格：${size}\n` +
        `🌟 图像生成成功！\n` +
        `以下是结果：\n\n` +
        `![生成的图像](${imageUrl})`;

    const responsePayload = {
        id: uniqueId,
        object: "chat.completion.chunk",
        created: createdTimestamp,
        model: model,
        system_fingerprint: systemFingerprint,
        choices: [{
            index: 0,
            delta: {
                content: content,
            },
            finish_reason: "stop",
        }, ],
    };

    const dataString = JSON.stringify(responsePayload);

    return new Response(`data: ${dataString}\n\n`, {
        status: 200,
        headers: {
            "Content-Type": "text/event-stream",
            'Access-Control-Allow-Origin': '*',
            "Access-Control-Allow-Headers": '*',
        },
    });
}

function handleNonStreamResponse(originalPrompt, translatedPrompt, size, model, imageUrl) {
    const uniqueId = `chatcmpl-${Date.now()}`;
    const createdTimestamp = Math.floor(Date.now() / 1000);
    const systemFingerprint = "fp_" + Math.random().toString(36).substr(2, 9);
    const content = `🎨 原始提示词：${originalPrompt}\n` +
        `🌐 翻译后的提示词：${translatedPrompt}\n` +
        `📐 图像规格：${size}\n` +
        `🌟 图像生成成功！\n` +
        `以下是结果：\n\n` +
        `![生成的图像](${imageUrl})`;

    const response = {
        id: uniqueId,
        object: "chat.completion",
        created: createdTimestamp,
        model: model,
        system_fingerprint: systemFingerprint,
        choices: [{
            index: 0,
            message: {
                role: "assistant",
                content: content
            },
            finish_reason: "stop"
        }],
        usage: {
            prompt_tokens: translatedPrompt.length,
            completion_tokens: content.length,
            total_tokens: translatedPrompt.length + content.length
        }
    };

    const dataString = JSON.stringify(response);

    return new Response(dataString, {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*'
        }
    });
}

async function postRequest(model, jsonBody) {
    const cf_account = CF_ACCOUNT_LIST[Math.floor(Math.random() * CF_ACCOUNT_LIST.length)];
    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${cf_account.account_id}/ai/run/${model}`;
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${cf_account.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(jsonBody)
    });

    if (!response.ok) {
        throw new Error('Unexpected response ' + response.status);
    }
    return response;
}

function extractImageSize(prompt, RATIO_MAP) {
    const match = prompt.match(/---(\d+:\d+)/);
    return match ? RATIO_MAP[match[1].trim()] || "1024x1024" : "1024x1024";
}

function extractImageUrl(prompt) {
    const regex = /(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|bmp|webp|svg))/i;
    const match = prompt.match(regex);
    return match ? match[0] : null;
}

function extractTranslate(prompt) {
    const match = prompt.match(/---n?tl/);
    if (match && match[0]) {
        if (match[0] == "---ntl") {
            return false;
        } else if (match[0] == "---tl") {
            return true;
        }
    }
    return CF_IS_TRANSLATE;
}

function cleanPromptString(prompt) {
    return prompt.replace(/---\d+:\d+/, "").replace(/---n?tl/, "").replace(/https?:\/\/\S+\.(?:png|jpe?g|gif|bmp|webp|svg)/gi, "").trim();
}

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});
