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
}`,a=Math.tan(19*Math.PI/180),o=.2866;function s(e,t,n,r){let i=1/Math.tan(e/2),a=1/(n-r);return new Float32Array([i/t,0,0,0,0,i,0,0,0,0,(r+n)*a,-1,0,0,2*r*n*a,0])}function c(e,t,n){let r=f([e[0]-t[0],e[1]-t[1],e[2]-t[2]]),i=f(u(n,r)),a=u(r,i);return new Float32Array([i[0],a[0],r[0],0,i[1],a[1],r[1],0,i[2],a[2],r[2],0,-d(i,e),-d(a,e),-d(r,e),1])}function l(e,t){let n=new Float32Array(16);for(let r=0;r<4;r++)for(let i=0;i<4;i++)n[r*4+i]=e[i]*t[r*4]+e[4+i]*t[r*4+1]+e[8+i]*t[r*4+2]+e[12+i]*t[r*4+3];return n}var u=(e,t)=>[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]],d=(e,t)=>e[0]*t[0]+e[1]*t[1]+e[2]*t[2],f=e=>{let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]};function p(u,d){let f=u.getContext(`webgl2`,{alpha:!1,antialias:!1,depth:!1,premultipliedAlpha:!1});if(!f)return null;let{celular:p}=d,m=(e,t)=>{let n=f.createShader(e);if(f.shaderSource(n,t),f.compileShader(n),!f.getShaderParameter(n,f.COMPILE_STATUS))throw Error(f.getShaderInfoLog(n)??`shader`);return n},h=(e,t)=>{let n=f.createProgram();if(f.attachShader(n,m(f.VERTEX_SHADER,e)),f.attachShader(n,m(f.FRAGMENT_SHADER,t)),f.linkProgram(n),!f.getProgramParameter(n,f.LINK_STATUS))throw Error(f.getProgramInfoLog(n)??`programa`);return n},g=h(t,n),_=h(r,i),v=p?140:240,y=new Float32Array(v*v*2);for(let e=0;e<v;e++)for(let t=0;t<v;t++)y[(e*v+t)*2]=t/(v-1),y[(e*v+t)*2+1]=e/(v-1);let b=new Uint32Array((v-1)*(v-1)*6),x=0;for(let e=0;e<v-1;e++)for(let t=0;t<v-1;t++){let n=e*v+t;b.set([n,n+1,n+v,n+1,n+v+1,n+v],x),x+=6}let S=f.createVertexArray();f.bindVertexArray(S),f.bindBuffer(f.ARRAY_BUFFER,f.createBuffer()),f.bufferData(f.ARRAY_BUFFER,y,f.STATIC_DRAW);let C=f.getAttribLocation(g,`a_grilla`);f.enableVertexAttribArray(C),f.vertexAttribPointer(C,2,f.FLOAT,!1,0,0),f.bindBuffer(f.ELEMENT_ARRAY_BUFFER,f.createBuffer()),f.bufferData(f.ELEMENT_ARRAY_BUFFER,b,f.STATIC_DRAW);let w=f.createVertexArray();f.bindVertexArray(w),f.bindBuffer(f.ARRAY_BUFFER,f.createBuffer()),f.bufferData(f.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),f.STATIC_DRAW);let T=f.getAttribLocation(_,`a_pos`);f.enableVertexAttribArray(T),f.vertexAttribPointer(T,2,f.FLOAT,!1,0,0),f.bindVertexArray(null);let E=e=>f.getUniformLocation(g,e),D=e=>f.getUniformLocation(_,e),O={vp:E(`u_vp`),t:E(`u_t`),pliegues:E(`u_pliegues`),camara:E(`u_camara`),luz:E(`u_luz`),brillo:E(`u_brillo`),lineas:E(`u_lineas`),cerca:E(`u_cerca`),lejos:E(`u_lejos`),escena:D(`u_escena`),res:D(`u_res`),foco:D(`u_foco`),apertura:D(`u_apertura`),radioMax:D(`u_radioMax`),td:D(`u_t`),muestras:D(`u_muestras`)},k=Math.min(p?2:4,f.getParameter(f.MAX_SAMPLES)),A=f.createFramebuffer(),j=f.createRenderbuffer(),M=f.createRenderbuffer(),N=f.createFramebuffer(),P=f.createTexture(),F=p?.6:.85,I=d.pixeles??(p?45e4:13e5),L=0,R=0,z=()=>{let e=Math.min(devicePixelRatio||1,2),t=Math.max(1,u.clientWidth*e),n=Math.max(1,u.clientHeight*e),r=Math.min(F,Math.sqrt(I/(t*n))),i=Math.max(1,Math.round(t*r)),a=Math.max(1,Math.round(n*r));(i!==L||a!==R)&&(L=i,R=a,u.width=i,u.height=a,f.bindRenderbuffer(f.RENDERBUFFER,j),f.renderbufferStorageMultisample(f.RENDERBUFFER,k,f.RGBA8,i,a),f.bindRenderbuffer(f.RENDERBUFFER,M),f.renderbufferStorageMultisample(f.RENDERBUFFER,k,f.DEPTH_COMPONENT24,i,a),f.bindFramebuffer(f.FRAMEBUFFER,A),f.framebufferRenderbuffer(f.FRAMEBUFFER,f.COLOR_ATTACHMENT0,f.RENDERBUFFER,j),f.framebufferRenderbuffer(f.FRAMEBUFFER,f.DEPTH_ATTACHMENT,f.RENDERBUFFER,M),f.bindTexture(f.TEXTURE_2D,P),f.texImage2D(f.TEXTURE_2D,0,f.RGBA8,i,a,0,f.RGBA,f.UNSIGNED_BYTE,null),f.texParameteri(f.TEXTURE_2D,f.TEXTURE_MIN_FILTER,f.LINEAR),f.texParameteri(f.TEXTURE_2D,f.TEXTURE_MAG_FILTER,f.LINEAR),f.texParameteri(f.TEXTURE_2D,f.TEXTURE_WRAP_S,f.CLAMP_TO_EDGE),f.texParameteri(f.TEXTURE_2D,f.TEXTURE_WRAP_T,f.CLAMP_TO_EDGE),f.bindFramebuffer(f.FRAMEBUFFER,N),f.framebufferTexture2D(f.FRAMEBUFFER,f.COLOR_ATTACHMENT0,f.TEXTURE_2D,P,0),f.bindFramebuffer(f.FRAMEBUFFER,null))},B=e;return{dibujar:(e,t)=>{z();let n=e*B.velocidad,r=.6+Math.sin(n*.045)*.2*B.camara+t[0]*.1*B.camara,i=.78+Math.sin(n*.06)*.04*B.camara-t[1]*.05*B.camara,u=8.5,d=[Math.sin(n*.031)*1.6*B.camara,0,Math.cos(n*.023)*1.6*B.camara],m=[d[0]+Math.cos(i)*Math.sin(r)*u,Math.sin(i)*u,d[2]+Math.cos(i)*Math.cos(r)*u],h=L/R,v=l(s(2*Math.atan(h>=1?a:o/h),h,.1,60),c(m,d,[0,1,0]));f.bindFramebuffer(f.FRAMEBUFFER,A),f.viewport(0,0,L,R),f.clearColor(.008,.02,.06,1),f.clear(f.COLOR_BUFFER_BIT|f.DEPTH_BUFFER_BIT),f.enable(f.DEPTH_TEST),f.useProgram(g),f.uniformMatrix4fv(O.vp,!1,v),f.uniform1f(O.t,n),f.uniform1f(O.pliegues,B.pliegues),f.uniform3fv(O.camara,m),f.uniform3f(O.luz,-.75,.6,-.35),f.uniform1f(O.brillo,B.brillo),f.uniform1f(O.lineas,B.lineas),f.uniform1f(O.cerca,4.5),f.uniform1f(O.lejos,17),f.bindVertexArray(S),f.drawElements(f.TRIANGLES,b.length,f.UNSIGNED_INT,0),f.disable(f.DEPTH_TEST),f.bindFramebuffer(f.READ_FRAMEBUFFER,A),f.bindFramebuffer(f.DRAW_FRAMEBUFFER,N),f.blitFramebuffer(0,0,L,R,0,0,L,R,f.COLOR_BUFFER_BIT,f.NEAREST),f.bindFramebuffer(f.FRAMEBUFFER,null),f.viewport(0,0,L,R),f.useProgram(_),f.activeTexture(f.TEXTURE0),f.bindTexture(f.TEXTURE_2D,P),f.uniform1i(O.escena,0),f.uniform2f(O.res,L,R),f.uniform1f(O.foco,.33+.12*Math.sin(n*.09)),f.uniform1f(O.apertura,3.2*B.desenfoque),f.uniform1f(O.radioMax,L/1200*(p?9:16)),f.uniform1f(O.td,n),f.uniform1i(O.muestras,p?12:24),f.bindVertexArray(w),f.drawArrays(f.TRIANGLE_STRIP,0,4),f.bindVertexArray(null)}}}function m(e,t){let n=[0,0],r=[0,0];matchMedia(`(pointer: fine)`).matches&&addEventListener(`pointermove`,e=>{n[0]=e.clientX/innerWidth*2-1,n[1]=e.clientY/innerHeight*2-1},{passive:!0});let i=!0,a=!1,o=!0,s=performance.now(),c=l=>{!i||document.hidden?a=!1:(r[0]+=(n[0]-r[0])*.04,r[1]+=(n[1]-r[1])*.04,t((l-s)/1e3,r),o&&(o=!1,e.style.opacity=`1`),requestAnimationFrame(c))},l=()=>{a||(a=!0,requestAnimationFrame(c))};`IntersectionObserver`in window&&new IntersectionObserver(([e])=>{i=e.isIntersecting,i&&l()}).observe(e),document.addEventListener(`visibilitychange`,()=>!document.hidden&&l()),e.addEventListener(`webglcontextlost`,()=>{e.style.opacity=`0`,i=!1}),l()}function h(){let e=document.querySelector(`[data-fondo-tela] canvas`);if(!e||matchMedia(`(prefers-reduced-motion: reduce)`).matches||navigator.connection?.saveData)return;let t=matchMedia(`(pointer: coarse), (max-width: 767px)`).matches,n=p(e,{celular:t});n&&m(e,n.dibujar)}try{h()}catch{}