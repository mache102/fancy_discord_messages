
// ==UserScript==
// @name         Discord Text To Image
// @namespace    http://tampermonkey.net/
// @version      2025-04-01
// @description  send text as fancy image (no this isnt an april fools joke)
// @author       vec3f
// @match        https://discord.com/channels/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=discord.com
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

/*
sus logger

differentiate logged msgs from sentry logs
*/
var amogus = (function() {
  const log_content_style = `background-color: rgba(255, 0, 0, 0.5); font-size: 16px; font-weight: 700; font-family: "Courier New", monospace;`;
  const log_prefix_style = `color: red;` + log_content_style;

  const PREFIX = "sus";

  function trace(...args) {
    console.trace(
      `%c[${PREFIX}] %c%s`,
      log_prefix_style, // applied to "[vc_script]"
      log_content_style, // applied to the args
      ...args
    );
  }
  
  function log(...args) {
    console.log(
      `%c[${PREFIX}] %c%s`,
      log_prefix_style, // applied to "[vc_script]"
      log_content_style, // applied to the args
      ...args
    );
    // trace();
  }

  return {
    trace,
    log
  };
})();


var cmd_parser = (function() {

  /*
  1. send a message:
  !!img[size=96,font=Arial,color=white,bg=discord,pad=20,width=1600] Your message here

  1a. send a message with a preset config:
  !!img[config=big_fancy_text] Your message here

  2. set a config:
  !!setconfig[name=big_fancy_text,size=96,color=white,bg=discord,pad=20,width=1600]
  if the config exists, it will be overwritten

  3. delete a config:
  !!delconfig[name=big_fancy_text]
  */

  const colorMappings = {
    'discord': '#36393f',
    'black': '#000000',
    'white': '#ffffff',
    'red': '#ff0000',
    'green': '#00ff00',
    'blue': '#0000ff',
    'yellow': '#ffff00',
    'purple': '#800080',
    'orange': '#ffa500',
    'pink': '#ffc0cb',
    'gray': '#808080',
    'none': null,
  };

  const default_config = {
    fontName: 'Arial',
    fontSize: 24,
    textColor: 'white',
    bgColor: '#36393f',
    padding: 20,
    maxWidth: 1600
  };

  const PREFIX = "!!";
  const IMG_PREFIX = `${PREFIX}img`;
  const SET_CONFIG_PREFIX = `${PREFIX}setconfig`;
  const DEL_CONFIG_PREFIX = `${PREFIX}delconfig`;

  let img_match_re = new RegExp(`^${IMG_PREFIX}\\[([^\\]]*)\\]\\s*(.*)`, 's');
  let setconfig_match_re = new RegExp(`^${SET_CONFIG_PREFIX}\\[([^\\]]*)\\]`, 's');
  let delconfig_match_re = new RegExp(`^${DEL_CONFIG_PREFIX}\\[([^\\]]*)\\]`, 's');

  function parse(message) {
    if (message.startsWith(IMG_PREFIX)) {
      return parseImgCommand(message);
    } else if (message.startsWith(SET_CONFIG_PREFIX)) {
      return parseSetConfigCommand(message);
    } else if (message.startsWith(DEL_CONFIG_PREFIX)) {
      return parseDelConfigCommand(message);
    }
    
    return null;
  }

  const CONFIG_SPLIT_CHAR = ',';
  const CONFIG_PAIR_SPLIT_CHAR = '=';

  function parse_config(configStr) {
    let config = {...default_config};
    const optionPairs = configStr.split(CONFIG_SPLIT_CHAR);
    for (const pair of optionPairs) {
      const [key, value] = pair.split(CONFIG_PAIR_SPLIT_CHAR).map(s => s.trim());
      
      if (!key || !value) continue;

      switch (key.toLowerCase()) {
        case 'name':
          config.name = value;
          break;
        case 'font':
          config.fontName = value;
          break;
        case 'size':
          config.fontSize = parseInt(value) || default_config.fontSize;
          break;
        case 'color':
          config.textColor = colorMappings[value.toLowerCase()] || value;
          break;
        case 'stroke':
          config.strokeColor = colorMappings[value.toLowerCase()] || value;
          break;
        case 'ssize':
          config.strokeSize = parseInt(value) || default_config.strokeSize;
          break;
        case 'bg':
          config.bgColor = colorMappings[value.toLowerCase()] || value;
          break;
        case 'pad':
          config.padding = parseInt(value) || default_config.padding;
          break;
        case 'width':
          config.maxWidth = parseInt(value) || default_config.maxWidth;
          break;

        case 'emoji':
          config.emoji = value;
          break;
      }
    }

    return config;
  }

  /*
  returns:
  {
    action: str,
    config: obj,
    text: str
  }
  */
  function parseImgCommand(message) {
    let config = {...default_config};
    let text = message;
    const configMatch = message.match(img_match_re);
    if (configMatch) {
      const configStr = configMatch[1];
      text = configMatch[2];
      
      config = parse_config(configStr);
    } else {
      // No config specified, just extract text
      text = message.substring(IMG_PREFIX.length).trim();
    }
    
    return {
      action: 'render',
      config,
      text
    };
  }

  /*
  returns:
  {
    action: str,
    config: obj,
  }
  */
  function parseSetConfigCommand(message) {
    let config = {...default_config};

    const configMatch = message.match(setconfig_match_re);
    if (configMatch) {
      const configStr = configMatch[1];
      
      config = parse_config(configStr);
    }
    
    if (!config.name) {
      return null; // Config name is required
    }
    
    return {
      action: 'setconfig',
      config
    };
  }

    /*
  returns:
  {
    action: str,
    configName: str
  }
  */
  function parseDelConfigCommand(message) {
    let configName = null;
    
    const configMatch = message.match(delconfig_match_re);
    if (configMatch) {
      const configStr = configMatch[1];
      
      // Parse the config
      const optionPairs = configStr.split('|');
      for (const pair of optionPairs) {
        const [key, value] = pair.split(':').map(s => s.trim());
        
        if (!key || !value) continue;
        
        if (key.toLowerCase() === 'name') {
          configName = value;
          break;
        }
      }
    }
    
    if (!configName) {
      return null; // Config name is required
    }
    
    return {
      action: 'delconfig',
      configName
    };
  }

  return {
    parse,
    default_config,
    PREFIX
  };
})();

// iframe storage works but gm set/getvalue is simpler
var storage_wrapper = (function() {
  function set(key, value) {
    if (typeof value === 'object') {
      value = JSON.stringify(value);
    }

    // set in gm storage
    GM_setValue(key, value);
  }

  function get(key) {
    let value = GM_getValue(key);
    try {
      return JSON.parse(value);
    } catch (e) {
      return value;
    }

    return null;
  }

  return {
    set,
    get
  };
})();

var emojis = (function() {
  const STRING_EMOJI_MAP = {
    "smile": "😄",
    "sad": "😢",
    "angry": "😡",
    "sob": "😭",
    "heart_eyes": "😍",
    "heart": "❤️",
    "fire": "🔥",
    "thumbsup": "👍",
    "thumbsdown": "👎",
    "clap": "👏",
    "laugh": "😂",
    "wow": "😮",
    "confused": "🤔",
    "party": "🎉",
    "rocket": "🚀",
    "eyes": "👀",
    "wave": "👋",
    "star": "⭐",
    "check": "✅",
    "cross": "❌",
    "clock": "⏰",
    "gift": "🎁",
    "coffee": "☕",
    "music": "🎵",
    "thinking": "💭",
    "pray": "🙏",
    "cool": "😎",
    "sleep": "😴",
    "money": "💰",
  };

  return {
    STRING_EMOJI_MAP,
  };
})();


var renderer = (function() {
  let configs = {};


  function load_configs() {
    let stored_configs = storage_wrapper.get('fancy_discord_messages_configs');
    if (stored_configs) {
      try {
        configs = JSON.parse(stored_configs);
      } catch (e) {
      }

      amogus.log(`Loaded ${Object.keys(configs).length} stored configs`);
    } else {
      amogus.log('No stored configs found');
    }
  }

  function save_configs() {
    storage_wrapper.set('fancy_discord_messages_configs', JSON.stringify(configs));
  }

  // before unloading the page, save the configs
  window.addEventListener('beforeunload', save_configs);

  function get_config(name) {
    amogus.log(`Retrieving config ${name}:`, config);
    return configs[name];
  }

  function set_config(name, config) {
    configs[name] = config;
    amogus.log(`Saved config ${name}:`, config);
  }

  function del_config(name) {
    delete configs[name];
    amogus.log(`Deleted config ${name}`);
  }

  load_configs();

  return {
    get_config,
    set_config,
    del_config
  };
})();

(async function() {
  // fonts
  class Font {
    constructor(name, url) {
      this.name = name;
      this.url = url; 
    }
  }
  async function load_all_fonts(fonts) {    
    for (let font of fonts) {
      try {
        const fontFace = new FontFace(font.name, `url(${font.url})`);
        await fontFace.load();
        document.fonts.add(fontFace);
        
        amogus.log(`Loaded font for canvas: ${font.name}`);
      } catch (err) {
        console.error(`Failed to load font ${font.name}:`, err);
      }
    }
  }
  const FONTS = [
    new Font("Comic Neue", "https://fonts.gstatic.com/s/comicneue/v8/4UaHrEJDsxBrF37olUeD96rp5w.woff2"),
    new Font("Creepster", "https://fonts.gstatic.com/s/creepster/v13/AlZy_zVUqJz4yMrniH4Rcn35.woff2"),
    new Font("Great Vibes", "https://fonts.gstatic.com/s/greatvibes/v19/RWmMoKWR9v4ksMfaWd_JN9XFiaQ.woff2"),
    new Font("Roboto", "https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbVmUiAo.woff2"),
    new Font("Open Sans", "https://fonts.gstatic.com/s/opensans/v40/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0B4gaVI.woff2"),
    new Font("Montserrat", "https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXo.woff2"),
    new Font("Ubuntu", "https://fonts.gstatic.com/s/ubuntu/v20/4iCs6KVjbNBYlgoKfw72.woff2"),
    new Font("Lora", "https://fonts.gstatic.com/s/lora/v35/0QI6MX1D_JOuGQbT0gvTJPa787weuxJBkq0.woff2"),
    new Font("Merriweather", "https://fonts.gstatic.com/s/merriweather/v31/u-4D0qyriQwlOrhSvowK_l5UcA6zuSYEqOzpPe3HOZJ5eX1WtLaQwmYiScCmDxhtNOKl8yDr3icaFF31.woff2"),
    new Font("Fleur De Leah", "https://fonts.gstatic.com/s/fleurdeleah/v9/AYCNpXX7ftYZWLhv9UmPJTMC1vGn4Q.woff2")
  ];
  await load_all_fonts(FONTS);
  
  function random_font() {
    return FONTS[Math.floor(Math.random() * FONTS.length)].name;
  }

  // at minimum, authorization and x super properties are required
  // idk about the rest but its a breeze to include them so sure ig
  let headers_to_grab = new Set([ 
    "Authorization",
    "X-Super-Properties",
    "X-Debug-Options",
    "X-Discord-Locale",
    "X-Discord-Timezone"
  ]);
  let request_upload_headers = { // request upload info
    "Content-Type": "application/json"
  };
  let perform_upload_headers = { // perform actual upload
    'Content-Type': 'application/octet-stream',
    'Origin': 'https://discord.com',
    'Referer': 'https://discord.com/'
  };

  // Get the channel ID from the URL
  function getChannelId() {
    return window.location.href.split('/').pop();
  }
  
  /*
  upload our image to discord. this 2-step process is done prior to sending the `message` xhr 
  */
  async function uploadImageToDiscord(canvas, channelId) {      
    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/png');
    });

    // step 1: request to get an upload url (where to upload to) and upload filename (what to name it as)
    let payload = {
      "files": [
        {
          "filename": "text.png",
          "file_size": blob.size,
          "id": "0",
          "is_clip": false
        }
      ]
    };
    
    amogus.log(`Getting upload info for channel ${channelId}`);
    const response = await fetch(`https://discord.com/api/v9/channels/${channelId}/attachments`, {
      method: 'POST',
      headers: request_upload_headers,
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get upload URL: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    

    
    // step 2: upload the attachment to storage at uploadUrl
    amogus.log(`Uploading file to Google Cloud Storage`);
    const uploadUrl = responseData.attachments[0].upload_url;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: perform_upload_headers,
      body: blob
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload file: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }
    
    amogus.log(`Successfully uploaded file to Google Cloud Storage`);
    
    // return the response data
    // when we send the messages xhr, we'll need the upload_filename
    return responseData;
  }
  
  const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    if (headers_to_grab.has(header)) { // grab some auth headers
      if (!request_upload_headers[header]) {
        request_upload_headers[header] = value;
        amogus.log(`Captured header: ${header}`);
      }
    }
    return originalXHRSetRequestHeader.apply(this, arguments);
  };


  function is_cmd(data) {
    amogus.log(`prefix: ${cmd_parser.PREFIX}, content: ${data.content}`);
    return (data.content && !data.attachments && data.content.startsWith(cmd_parser.PREFIX));
  }

  /*
  randomly fills the canvas with the emoji

  the fill density is proportionate to the canvas size
  font sizes are between a * fontsize and b * fontsize

  each with random pos and rotation
  the pos range is extended by the font size on each side
  */
  function emoji_random_fill(ctx, emoji, fontSize) {
    const density = 0.2; // 10% of the canvas will be filled with emojis
    const min_size_factor = 0.5;
    const max_size_factor = 2.0;

    const canvas = ctx.canvas;
    const width = canvas.width;
    const height = canvas.height;
    amogus.log(`emoji: ${emoji}`);
    amogus.log(`c w,h: ${width}, ${height}`);

    const num_emojis = Math.floor((width * height) * density / (fontSize * fontSize));
    amogus.log(`num emojis: ${num_emojis}`);

    ctx.font = `${fontSize}px Arial`;

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';

    for (let i = 0; i < num_emojis; i++) {
      const size_factor = Math.random() * (max_size_factor - min_size_factor) + min_size_factor;
      const emojiSize = fontSize * size_factor;

      const ses = emojiSize * 0.2;

      const x = Math.random() * (width + 2 * ses) - ses;
      const y = Math.random() * (height + 2 * ses) - ses;
      amogus.log(`x,y: ${x}, ${y}`);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.random() * Math.PI * 2);
      ctx.font = `${emojiSize}px Arial`;
      ctx.fillText(emoji, 0, 0);
      ctx.restore();
    }

    // restore translate
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    amogus.log(`Filled canvas with ${num_emojis} emojis`);
  }

  // wrapper func
  function text_to_image(text, config = {}) {
    amogus.log(`config before`, config);
    const { 
      fontName = 'Arial',
      fontSize = 96, 
      textColor = 'white',
      strokeColor = 'null',
      strokeSize = 5,
      bgColor = '#36393f', // Discord dark theme color
      padding = 20, // padding around the text in pixels
      maxWidth = 1600, // max width of the image in pixels

      emoji = null
    } = config;

    
    const measuringCanvas = document.createElement('canvas');
    const measuringCtx = measuringCanvas.getContext('2d');

    // pick a random font
    let font = `${fontSize}px ${fontName}`;
    measuringCtx.font = font;
    
    // measure and wrap text
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];
    let maxLineWidth = 0; // measure true line width, used if smaller than maxWidth
    
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = measuringCtx.measureText(currentLine + ' ' + word).width;
      if (width < maxWidth - padding * 2) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        maxLineWidth = Math.max(maxLineWidth, measuringCtx.measureText(currentLine).width);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    maxLineWidth = Math.max(maxLineWidth, measuringCtx.measureText(currentLine).width);
    
    const canvas = document.createElement('canvas');
    const lineHeight = fontSize * 1.2;
    canvas.width = Math.min(maxWidth, maxLineWidth + padding * 2);
    canvas.height = lines.length * lineHeight + padding * 2;
    const ctx = canvas.getContext('2d');

    // start drawing
    if (bgColor !== null) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (emoji !== null) {
      let actual_emoji = emojis.STRING_EMOJI_MAP[emoji];
      if (actual_emoji) {
        emoji_random_fill(ctx, actual_emoji, fontSize);
      }
    }
    

    ctx.font = font;
    ctx.textBaseline = 'top';
    // revert textailgn
    ctx.textAlign = 'left';

    if (strokeColor !== null) {
      // set miter
      ctx.lineJoin = 'miter';
      // rounde
      ctx.lineCap = 'round';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeSize;
      
      for (let i = 0; i < lines.length; i++) {
        ctx.strokeText(lines[i], padding, padding + i * lineHeight);
      }
    }

    ctx.fillStyle = textColor;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], padding, padding + i * lineHeight);
    }

    amogus.log(`end of text_to_image`);
    
    return canvas;
  }
  
  function render_msg(xhr, data, args, i, res) {
    let {text, config} = res;
    if (config.name) { // we override the config with the stored one
      let stored_config = renderer.get_config(config.name);
      if (stored_config) {
        config = stored_config; 
      }
    }
    amogus.log(`text, config`, text, config);
    const canvas = text_to_image(text, config);
    amogus.log(`canvas, width, height`, canvas, canvas.width, canvas.height);
    // remove data content
    delete data.content;
    
    uploadImageToDiscord(canvas, getChannelId())
      .then(response => {
        amogus.log(`Uploaded image: ${JSON.stringify(response)}`);
        data.attachments = [{
          id: "0",
          filename: "text.png",
          uploaded_filename: response.attachments[0].upload_filename
        }];

        // remove:
        // mobile_network_type, tts, flags
        // add the channel id, type=0
        for (let key of ["mobile_network_type", "tts", "flags"]) {
          delete data[key];
        }
        data.channel_id = getChannelId();
        data.type = 0;

        // thats it we can send now
        args[i] = JSON.stringify(data);
        originalXHRSend.apply(xhr, args);
      })
      .catch(err => {
        amogus.log('Failed to upload image:', err);
        originalXHRSend.apply(xhr, args);
      });
  }

  const process_cmd = (xhr, data, args, i) => {
    let res;
    amogus.log(`data content`, data.content);
    try {
      res = cmd_parser.parse(data.content);
    } catch (e) {
      amogus.log('Failed to parse command:', e);
      return;
    }
    amogus.log(`res:`, res);
    if (!res) {
      return;
    }

    amogus.log(`action: ${res.action}, config:`, res.config, `text: ${res.text}`);

    if (res.action === 'render') {
      render_msg(xhr, data, args, i, res);

    } else if (res.action === 'setconfig') {
      renderer.set_config(res.config.name, res.config);
    } else if (res.action === 'delconfig') {
      renderer.del_config(res.configName);
    }
    
  };
    
  const originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...args) {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      try {
        let data = JSON.parse(arg);
        
        if (is_cmd(data)) {
          process_cmd(this, data, args, i);

          // we sent our own so we prevent this one from being sent
          return;
        }
      } catch (e) {
      }
    }
    
    return originalXHRSend.apply(this, args);
  };
})();