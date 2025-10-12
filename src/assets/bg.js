document.addEventListener("astro:page-load", () => {
	if (!(window.location.pathname == "/2026/cfp/")) return;

	const canvas = document.getElementById("bg");
	const gl = canvas.getContext("webgl");
	if (!gl) {
		alert("WebGL not supported");
	}
	const vert = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos,0.0,1.0); }
`;

	const frag = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  float a=hash(i), b=hash(i+vec2(1,0));
  float c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
  vec2 u=f*f*(3.0-2.0*f);
  return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;
}

// RGB <-> HSV
vec3 rgb2hsv(vec3 c){
  vec4 K=vec4(0.,-1./3.,2./3.,-1.);
  vec4 p=mix(vec4(c.bg,K.wz), vec4(c.gb,K.xy), step(c.b,c.g));
  vec4 q=mix(vec4(p.xyw,c.r), vec4(c.r,p.yzx), step(p.x,c.r));
  float d=q.x-min(q.w,q.y);
  float e=1e-10;
  return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)), d/(q.x+e), q.x);
}
vec3 hsv2rgb(vec3 c){
  vec3 p=abs(fract(c.xxx+vec3(0.,1.,2.)/3.)*6.-3.);
  return c.z*mix(vec3(1.), clamp(p-1.,0.,1.), c.y);
}

// soft circle
float softCircle(vec2 uv, vec2 c, float r, float blur){
  float d=length(uv-c);
  return smoothstep(r, r-blur, d);
}

// diagonal light beam from top-right to bottom-left with decay and spread
float trapezoidLight(vec2 uv){
  // 考慮螢幕比例，右上角的實際座標
  float aspectRatio = u_res.x / u_res.y;
  vec2 start = vec2(aspectRatio, 1.0); // 真正的右上角
  vec2 end = vec2(0.0, 0.0);
  vec2 direction = normalize(end - start); // 對角線方向向量
  
  // 計算當前點到光束起點的向量
  vec2 toPoint = uv - start;
  
  // 計算點在光束方向上的投影距離
  float projDistance = dot(toPoint, direction);
  
  // 計算點到光束中心線的垂直距離
  vec2 projPoint = start + direction * projDistance;
  float perpDistance = length(uv - projPoint);
  
  // 光束寬度隨距離增加而擴散
  float beamWidth = 0.1 + projDistance * 0.3;
  
  // 檢查是否在光束範圍內
  float inBeam = smoothstep(beamWidth, beamWidth * 0.7, perpDistance);
  
  // 確保只在正確方向上發光（從起點到終點）
  float validRange = smoothstep(-0.1, 0.0, projDistance) * 
                     smoothstep(1.6, 1.4, projDistance);
  
  // 距離衰減：從起點開始衰減
  float distanceFromStart = length(toPoint);
  float decay = exp(-distanceFromStart * 1.2); // 指數衰減
  
  // 額外的柔和衰減
  float softDecay = smoothstep(1.8, 0.2, distanceFromStart);
  
  // 時間變化的強度波動（可選）
  float pulse = 0.8 + 0.2 * sin(u_time * 2.0);
  
  return inBeam * validRange * decay * softDecay * pulse;
}

void main(){
  vec2 uv=gl_FragCoord.xy/u_res;
  uv.x*=u_res.x/u_res.y;

  // ===== Grid =====
  vec2 guv=uv*10.0;
  float gx=smoothstep(0.48,0.52,abs(fract(guv.x)-0.5));
  float gy=smoothstep(0.48,0.52,abs(fract(guv.y)-0.5));
  float grid=max(gx,gy);
  vec3 col=vec3(0.05)+grid*0.5; // 更明顯的白色網格

  // ===== Blobs =====
  float t=u_time*0.3;
  float aspectRatio = u_res.x / u_res.y;
  
  // Pink EC87B8: z-index 1, width 50vw, bottom, move from left 30% to left 70%
  float pinkProgress = (sin(t * 0.8) + 1.0) * 0.5; // 0 to 1
  vec2 pinkPos = vec2(0.3 + pinkProgress * 0.5, 0.2); // left 30% to 70%, bottom
  pinkPos.x *= aspectRatio; // aspect ratio correction
  float pinkSize = 0.3 * aspectRatio; // 50vw equivalent
  float pinkBlob = softCircle(uv, pinkPos, pinkSize, pinkSize * 0.5);
  
  // Yellow DD8D3E: big width 60vw, static at left 0, bottom 0, shine brightness 60% to 100%
  vec2 yellowPos = vec2(0.32, 0.0); // left 0, bottom 0
  float yellowSize = 1.1; // 60vw equivalent
  float yellowBrightness = 0.6 + 0.4 * (sin(t * 1.2) + 1.0) * 0.5; // 60% to 100%
  float yellowBlob = softCircle(uv, yellowPos, yellowSize, yellowSize * 0.5);
  
  // Blue 4582D7: width 30vw, bottom left, curve from bottom 20%, left 0% to bottom 0%, left 30%
  float blueProgress = (sin(t * 0.6) + 1.0) * 0.5; // 0 to 1
  float blueCurveX = blueProgress * 0.3; // 0% to 30%
  float blueCurveY = 0.5 * (1.0 - blueProgress * blueProgress); // quadratic curve from 20% to 0%
  vec2 bluePos = vec2(blueCurveX * aspectRatio, blueCurveY);
  float blueSize = 0.22 * aspectRatio; // 30vw equivalent
  float blueBlob = softCircle(uv, bluePos, blueSize, blueSize * 0.5);
  
  // Red C45D3F: width 30vw, left 60%, bottom 0%, shine brightness 60% to 100%
  vec2 redPos = vec2(0.6 * aspectRatio, 0.0); // left 60%, bottom 0%
  float redSize = 0.3 * aspectRatio; // 30vw equivalent
  float redBrightness = 0.6 + 0.4 * (sin(t * 1.5) + 1.0) * 0.5; // 60% to 100%
  float redBlob = softCircle(uv, redPos, redSize, redSize * 0.5);

  // Colors
  vec3 pinkColor = vec3(0.925, 0.529, 0.722); // #EC87B8
  vec3 yellowColor = vec3(0.867, 0.553, 0.243); // #DD8D3E
  vec3 blueColor = vec3(0.271, 0.510, 0.843); // #4582D7
  vec3 redColor = vec3(0.769, 0.365, 0.247); // #C45D3F

  // Apply brightness modulation
  yellowColor *= yellowBrightness;
  redColor *= redBrightness;

  // Layer blobs (z-index consideration: pink is z-index 1, others on top)
  vec3 blob = vec3(0.0);
  
  // Pink first (z-index 1, bottom layer)
  blob += pinkColor * pinkBlob;
  
  // Then others on top
  blob = mix(blob, yellowColor, yellowBlob);
  blob = mix(blob, blueColor, blueBlob);
  blob = mix(blob, redColor, redBlob);
  
  // Total alpha for blending with background
  float totalAlpha = clamp(pinkBlob + yellowBlob + blueBlob + redBlob, 0.0, 1.0);
  col=mix(col, blob, totalAlpha);

  // ===== Top & Bottom gradient masks =====
  float topMask=smoothstep(0.7,1.0,uv.y); // 上面10%開始變黑
  float botMask=smoothstep(0.3,0.0,uv.y); // 下面10%開始變紫

  // 上黑 下紫 #010121
  col=mix(col, vec3(0.0), topMask);
  col=mix(col, vec3(0.004,0.004,0.129), botMask); // #010121

  // ===== Light beam =====
  float beam=trapezoidLight(uv);
  col=mix(col, vec3(0.9,0.95,1.0), beam*0.4);

  // ===== Noise =====
  float g=noise(gl_FragCoord.xy*0.6+u_time*60.0);
  col+= (g-0.5)*0.04;

  gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);
}
`;

	function compile(type, src) {
		const s = gl.createShader(type);
		gl.shaderSource(s, src);
		gl.compileShader(s);
		if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
			console.error(gl.getShaderInfoLog(s));
		}
		return s;
	}

	const vs = compile(gl.VERTEX_SHADER, vert);
	const fs = compile(gl.FRAGMENT_SHADER, frag);
	const prog = gl.createProgram();
	gl.attachShader(prog, vs);
	gl.attachShader(prog, fs);
	gl.linkProgram(prog);
	gl.useProgram(prog);

	const buf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buf);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
	const loc = gl.getAttribLocation(prog, "a_pos");
	gl.enableVertexAttribArray(loc);
	gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

	let isRendering = false;
	let animationId = null;

	const uRes = gl.getUniformLocation(prog, "u_res");
	const uTime = gl.getUniformLocation(prog, "u_time");

	function resize() {
		canvas.width = innerWidth * window.devicePixelRatio;
		canvas.height = innerHeight * window.devicePixelRatio;
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.uniform2f(uRes, canvas.width, canvas.height);
	}
	resize();
	addEventListener("resize", resize);

	function draw(t) {
		gl.uniform1f(uTime, t * 0.001);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
		requestAnimationFrame(draw);
	}
	const windowHeight = window.innerHeight;
	const observer = new IntersectionObserver(
		entries => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					if (!isRendering) {
						isRendering = true;
						requestAnimationFrame(draw);
					}
				} else {
					isRendering = false;
					if (animationId) {
						cancelAnimationFrame(animationId);
						animationId = null;
					}
				}
			});
		},
		{
			rootMargin: `${windowHeight}px 0px ${windowHeight}px 0px`,
			threshold: 0
		}
	);

	observer.observe(canvas);

	document.addEventListener("astro:before-preparation", () => {
		observer.disconnect();
		isRendering = false;
		if (animationId) {
			cancelAnimationFrame(animationId);
		}
	});
});
