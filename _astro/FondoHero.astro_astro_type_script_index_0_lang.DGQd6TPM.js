var e={pliegues:1,brillo:1,lineas:1,desenfoque:1,camara:1,velocidad:1},t=`#version 300 es
in vec2 a_grilla;
uniform mat4 u_vp;
uniform float u_t;
uniform float u_pliegues;
out vec3 v_pos;
out vec3 v_normal;
out vec2 v_grilla;

// Pliegues como de tela: crestas largas que se curvan, sobre un espacio deformado, y que se mueven despacio.
float altura(vec2 p, float t) {
  vec2 q = p + vec2(1.1 * sin(p.y * 0.21 + t * 0.06), 0.8 * sin(p.x * 0.17 - t * 0.05));
  float cresta = sin(q.x * 1.15 + 1.5 * sin(q.y * 0.32 + t * 0.07) + 0.6 * sin(q.y * 0.71 - t * 0.05));
  float h = 1.2 * cresta;
  h += 0.55 * sin(q.y * 0.45 + q.x * 0.25 - t * 0.08);
  h += 0.12 * sin(q.x * 2.1 - q.y * 1.1 + t * 0.11);
  return h * u_pliegues;
}

void main() {
  vec2 p = (a_grilla - 0.5) * 26.0;
  float h = altura(p, u_t);
  float e = 0.05;
  float hx = altura(p + vec2(e, 0.0), u_t);
  float hz = altura(p + vec2(0.0, e), u_t);
  v_normal = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
  v_pos = vec3(p.x, h, p.y);
  v_grilla = a_grilla;
  gl_Position = u_vp * vec4(v_pos, 1.0);
}`,n=`#version 300 es
precision highp float;
in vec3 v_pos;
in vec3 v_normal;
in vec2 v_grilla;
uniform vec3 u_camara;
uniform vec3 u_luz;
uniform float u_brillo;
uniform float u_lineas;
uniform float u_cerca;
uniform float u_lejos;
out vec4 color;

void main() {
  vec3 n = normalize(v_normal);
  vec3 v = normalize(u_camara - v_pos);
  if (dot(n, v) < 0.0) n = -n;
  vec3 l = normalize(u_luz);

  vec3 hondo = vec3(0.008, 0.02, 0.06);
  vec3 azul = vec3(0.078, 0.408, 0.988);
  vec3 celeste = vec3(0.45, 0.70, 1.0);

  // La cara que mira a la luz se tiñe del azul de la marca; la que no, queda en navy profundo. La luz "envuelve" un
  // poco (como en una tela), así el paso de una a otra es suave.
  float envuelta = max(dot(n, l) * 0.6 + 0.4, 0.0);
  vec3 c = mix(hondo, azul, pow(envuelta, 2.2));
  // Una luz de relleno, más débil y del otro lado, para que la sombra sea navy y no negra.
  c += azul * 0.16 * pow(max(dot(n, normalize(vec3(0.7, 0.45, 0.55))), 0.0), 1.5);
  c += vec3(0.007, 0.022, 0.06);
  // Los huecos entre pliegues, más oscuros.
  c *= 0.45 + 0.55 * smoothstep(-1.7, 0.7, v_pos.y);

  // Borde que se ilumina (Fresnel), más fuerte a contraluz, y un brillo amplio, como de seda.
  float fresnel = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  float contraluz = max(dot(-v, l) * 0.5 + 0.5, 0.0);
  c += azul * fresnel * (0.2 + 0.8 * contraluz) * 0.9 * u_brillo;
  c += celeste * pow(max(dot(n, normalize(l + v)), 0.0), 16.0) * 0.32 * u_brillo;

  // Líneas finas a lo largo de la lámina, con antialias: el detalle que deja ver qué está en foco.
  float x = v_grilla.y * 170.0;
  float d = abs(fract(x - 0.5) - 0.5) / fwidth(x);
  // Donde las líneas quedan más juntas que un par de píxeles se apagan: si no, hacen moiré.
  float linea = (1.0 - min(d, 1.0)) * (1.0 - smoothstep(0.25, 0.6, fwidth(x)));
  c += celeste * linea * 0.06 * u_lineas * (0.2 + envuelta);

  // Profundidad lineal (para el desenfoque) y bruma hacia el fondo.
  float dist = length(u_camara - v_pos);
  float prof = clamp((dist - u_cerca) / (u_lejos - u_cerca), 0.0, 1.0);
  c = mix(c, hondo, smoothstep(0.6, 1.0, prof));
  color = vec4(c, prof);
}`,r=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,i=`#version 300 es
precision highp float;
uniform sampler2D u_escena;
uniform vec2 u_res;
uniform float u_foco;
uniform float u_apertura;
uniform float u_radioMax;
uniform float u_t;
uniform int u_muestras;
in vec2 v_uv;
out vec4 color;

float coc(float prof) { return clamp(abs(prof - u_foco) * u_apertura, 0.0, 1.0) * u_radioMax; }

void main() {
  vec4 centro = texture(u_escena, v_uv);
  float radio = coc(centro.a);
  vec3 acum = centro.rgb;
  float peso = 1.0;
  for (int i = 0; i < 32; i++) {
    if (i >= u_muestras) break;
    float a = float(i) * 2.39996;
    float r = sqrt((float(i) + 0.5) / float(u_muestras)) * max(radio, 1.0);
    vec4 s = texture(u_escena, v_uv + vec2(cos(a), sin(a)) * r / u_res);
    // Una muestra suma si su propio círculo de desenfoque llega hasta acá: lo nítido no se derrama sobre lo demás.
    float w = smoothstep(r - 1.5, r + 1.5, max(coc(s.a), radio * 0.6));
    acum += s.rgb * w;
    peso += w;
  }
  vec3 c = acum / peso;
  // Grano muy fino, para que los degradés no hagan escalones.
  float g = fract(sin(dot(gl_FragCoord.xy + fract(u_t) * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
  c += (g - 0.5) * 0.02;
  color = vec4(c, 1.0);
}`;function a(e,t,n,r){let i=1/Math.tan(e/2),a=1/(n-r);return new Float32Array([i/t,0,0,0,0,i,0,0,0,0,(r+n)*a,-1,0,0,2*r*n*a,0])}function o(e,t,n){let r=u([e[0]-t[0],e[1]-t[1],e[2]-t[2]]),i=u(c(n,r)),a=c(r,i);return new Float32Array([i[0],a[0],r[0],0,i[1],a[1],r[1],0,i[2],a[2],r[2],0,-l(i,e),-l(a,e),-l(r,e),1])}function s(e,t){let n=new Float32Array(16);for(let r=0;r<4;r++)for(let i=0;i<4;i++)n[r*4+i]=e[i]*t[r*4]+e[4+i]*t[r*4+1]+e[8+i]*t[r*4+2]+e[12+i]*t[r*4+3];return n}var c=(e,t)=>[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]],l=(e,t)=>e[0]*t[0]+e[1]*t[1]+e[2]*t[2],u=e=>{let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]};function d(c,l){let u=c.getContext(`webgl2`,{alpha:!1,antialias:!1,depth:!1,premultipliedAlpha:!1});if(!u)return null;let{celular:d}=l,f=(e,t)=>{let n=u.createShader(e);if(u.shaderSource(n,t),u.compileShader(n),!u.getShaderParameter(n,u.COMPILE_STATUS))throw Error(u.getShaderInfoLog(n)??`shader`);return n},p=(e,t)=>{let n=u.createProgram();if(u.attachShader(n,f(u.VERTEX_SHADER,e)),u.attachShader(n,f(u.FRAGMENT_SHADER,t)),u.linkProgram(n),!u.getProgramParameter(n,u.LINK_STATUS))throw Error(u.getProgramInfoLog(n)??`programa`);return n},m=p(t,n),h=p(r,i),g=d?140:240,_=new Float32Array(g*g*2);for(let e=0;e<g;e++)for(let t=0;t<g;t++)_[(e*g+t)*2]=t/(g-1),_[(e*g+t)*2+1]=e/(g-1);let v=new Uint32Array((g-1)*(g-1)*6),y=0;for(let e=0;e<g-1;e++)for(let t=0;t<g-1;t++){let n=e*g+t;v.set([n,n+1,n+g,n+1,n+g+1,n+g],y),y+=6}let b=u.createVertexArray();u.bindVertexArray(b),u.bindBuffer(u.ARRAY_BUFFER,u.createBuffer()),u.bufferData(u.ARRAY_BUFFER,_,u.STATIC_DRAW);let x=u.getAttribLocation(m,`a_grilla`);u.enableVertexAttribArray(x),u.vertexAttribPointer(x,2,u.FLOAT,!1,0,0),u.bindBuffer(u.ELEMENT_ARRAY_BUFFER,u.createBuffer()),u.bufferData(u.ELEMENT_ARRAY_BUFFER,v,u.STATIC_DRAW);let S=u.createVertexArray();u.bindVertexArray(S),u.bindBuffer(u.ARRAY_BUFFER,u.createBuffer()),u.bufferData(u.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),u.STATIC_DRAW);let C=u.getAttribLocation(h,`a_pos`);u.enableVertexAttribArray(C),u.vertexAttribPointer(C,2,u.FLOAT,!1,0,0),u.bindVertexArray(null);let w=e=>u.getUniformLocation(m,e),T=e=>u.getUniformLocation(h,e),E={vp:w(`u_vp`),t:w(`u_t`),pliegues:w(`u_pliegues`),camara:w(`u_camara`),luz:w(`u_luz`),brillo:w(`u_brillo`),lineas:w(`u_lineas`),cerca:w(`u_cerca`),lejos:w(`u_lejos`),escena:T(`u_escena`),res:T(`u_res`),foco:T(`u_foco`),apertura:T(`u_apertura`),radioMax:T(`u_radioMax`),td:T(`u_t`),muestras:T(`u_muestras`)},D=Math.min(d?2:4,u.getParameter(u.MAX_SAMPLES)),O=u.createFramebuffer(),k=u.createRenderbuffer(),A=u.createRenderbuffer(),j=u.createFramebuffer(),M=u.createTexture(),N=d?.6:.85,P=d?45e4:13e5,F=0,I=0,L=()=>{let e=Math.min(devicePixelRatio||1,2),t=Math.max(1,c.clientWidth*e),n=Math.max(1,c.clientHeight*e),r=Math.min(N,Math.sqrt(P/(t*n))),i=Math.max(1,Math.round(t*r)),a=Math.max(1,Math.round(n*r));(i!==F||a!==I)&&(F=i,I=a,c.width=i,c.height=a,u.bindRenderbuffer(u.RENDERBUFFER,k),u.renderbufferStorageMultisample(u.RENDERBUFFER,D,u.RGBA8,i,a),u.bindRenderbuffer(u.RENDERBUFFER,A),u.renderbufferStorageMultisample(u.RENDERBUFFER,D,u.DEPTH_COMPONENT24,i,a),u.bindFramebuffer(u.FRAMEBUFFER,O),u.framebufferRenderbuffer(u.FRAMEBUFFER,u.COLOR_ATTACHMENT0,u.RENDERBUFFER,k),u.framebufferRenderbuffer(u.FRAMEBUFFER,u.DEPTH_ATTACHMENT,u.RENDERBUFFER,A),u.bindTexture(u.TEXTURE_2D,M),u.texImage2D(u.TEXTURE_2D,0,u.RGBA8,i,a,0,u.RGBA,u.UNSIGNED_BYTE,null),u.texParameteri(u.TEXTURE_2D,u.TEXTURE_MIN_FILTER,u.LINEAR),u.texParameteri(u.TEXTURE_2D,u.TEXTURE_MAG_FILTER,u.LINEAR),u.texParameteri(u.TEXTURE_2D,u.TEXTURE_WRAP_S,u.CLAMP_TO_EDGE),u.texParameteri(u.TEXTURE_2D,u.TEXTURE_WRAP_T,u.CLAMP_TO_EDGE),u.bindFramebuffer(u.FRAMEBUFFER,j),u.framebufferTexture2D(u.FRAMEBUFFER,u.COLOR_ATTACHMENT0,u.TEXTURE_2D,M,0),u.bindFramebuffer(u.FRAMEBUFFER,null))},R=e;return{dibujar:(e,t)=>{L();let n=e*R.velocidad,r=.6+Math.sin(n*.045)*.2*R.camara+t[0]*.1*R.camara,i=.78+Math.sin(n*.06)*.04*R.camara-t[1]*.05*R.camara,c=8.5,l=[Math.sin(n*.031)*1.6*R.camara,0,Math.cos(n*.023)*1.6*R.camara],f=[l[0]+Math.cos(i)*Math.sin(r)*c,Math.sin(i)*c,l[2]+Math.cos(i)*Math.cos(r)*c],p=F/I,g=s(a(2*Math.atan(Math.tan(19*Math.PI/180)*Math.max(1,1.5/p)**.5),p,.1,60),o(f,l,[0,1,0]));u.bindFramebuffer(u.FRAMEBUFFER,O),u.viewport(0,0,F,I),u.clearColor(.008,.02,.06,1),u.clear(u.COLOR_BUFFER_BIT|u.DEPTH_BUFFER_BIT),u.enable(u.DEPTH_TEST),u.useProgram(m),u.uniformMatrix4fv(E.vp,!1,g),u.uniform1f(E.t,n),u.uniform1f(E.pliegues,R.pliegues),u.uniform3fv(E.camara,f),u.uniform3f(E.luz,-.75,.6,-.35),u.uniform1f(E.brillo,R.brillo),u.uniform1f(E.lineas,R.lineas),u.uniform1f(E.cerca,4.5),u.uniform1f(E.lejos,17),u.bindVertexArray(b),u.drawElements(u.TRIANGLES,v.length,u.UNSIGNED_INT,0),u.disable(u.DEPTH_TEST),u.bindFramebuffer(u.READ_FRAMEBUFFER,O),u.bindFramebuffer(u.DRAW_FRAMEBUFFER,j),u.blitFramebuffer(0,0,F,I,0,0,F,I,u.COLOR_BUFFER_BIT,u.NEAREST),u.bindFramebuffer(u.FRAMEBUFFER,null),u.viewport(0,0,F,I),u.useProgram(h),u.activeTexture(u.TEXTURE0),u.bindTexture(u.TEXTURE_2D,M),u.uniform1i(E.escena,0),u.uniform2f(E.res,F,I),u.uniform1f(E.foco,.33+.12*Math.sin(n*.09)),u.uniform1f(E.apertura,3.2*R.desenfoque),u.uniform1f(E.radioMax,F/1200*(d?9:16)),u.uniform1f(E.td,n),u.uniform1i(E.muestras,d?12:24),u.bindVertexArray(S),u.drawArrays(u.TRIANGLE_STRIP,0,4),u.bindVertexArray(null)}}}function f(e,t){let n=[0,0],r=[0,0];matchMedia(`(pointer: fine)`).matches&&addEventListener(`pointermove`,e=>{n[0]=e.clientX/innerWidth*2-1,n[1]=e.clientY/innerHeight*2-1},{passive:!0});let i=!0,a=!1,o=!0,s=performance.now(),c=l=>{!i||document.hidden?a=!1:(r[0]+=(n[0]-r[0])*.04,r[1]+=(n[1]-r[1])*.04,t((l-s)/1e3,r),o&&(o=!1,e.style.opacity=`1`),requestAnimationFrame(c))},l=()=>{a||(a=!0,requestAnimationFrame(c))};new IntersectionObserver(([e])=>{i=e.isIntersecting,i&&l()}).observe(e),document.addEventListener(`visibilitychange`,()=>!document.hidden&&l()),e.addEventListener(`webglcontextlost`,()=>{e.style.opacity=`0`,i=!1}),l()}function p(){let e=document.querySelector(`[data-fondo-hero]`);if(!e||matchMedia(`(prefers-reduced-motion: reduce)`).matches||navigator.connection?.saveData)return;let t=matchMedia(`(pointer: coarse), (max-width: 767px)`).matches,n=d(e,{celular:t});n&&f(e,n.dibujar)}try{p()}catch{}