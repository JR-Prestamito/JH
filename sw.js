/* JR Prestamito PRO - Service Worker v3
   Permite abrir la app SIN internet. Los datos (clientes, préstamos) NO viven aquí:
   están en el almacenamiento del navegador; este archivo solo guarda una copia de la propia app.
   Para forzar que todos los celulares bajen una versión nueva, cambia CACHE_VERSION (v4, v5...). */
const CACHE_VERSION = "jrp-pro-v3";
const APP = "./index.html";
const ESPERA_RED_MS = 4000; // si la red tarda más, se abre la copia guardada

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function(c){
      // cache:"reload" = baja una copia fresca (no la que el navegador tenga a medias)
      return c.add(new Request(APP, { cache: "reload" })).catch(function(){});
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(ks){
      // Solo borra las copias viejas DE ESTA app (jrp-pro-...). Así no se lleva las de otras
      // apps que vivan en el mismo sitio (por ejemplo la beta).
      return Promise.all(ks.filter(function(k){ return k.indexOf("jrp-pro-") === 0 && k !== CACHE_VERSION; })
                           .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function paginaApp(req){
  return new Promise(function(resolve){
    let listo = false;
    const usarCopia = function(){
      caches.open(CACHE_VERSION).then(function(c){ return c.match(APP); }).then(function(r){
        if(!listo){ listo = true; resolve(r || Response.error()); }
      });
    };
    const t = setTimeout(usarCopia, ESPERA_RED_MS);
    fetch(req).then(function(resp){
      clearTimeout(t);
      // Aunque la red haya tardado y ya se abrió la copia, la nueva queda guardada para la próxima vez.
      if(resp && resp.ok){
        const copia = resp.clone();
        caches.open(CACHE_VERSION).then(function(c){ c.put(APP, copia); });
      }
      if(!listo){ listo = true; resolve(resp); }
    }).catch(function(){ clearTimeout(t); usarCopia(); });
  });
}

function archivoLocal(req){
  return caches.open(CACHE_VERSION).then(function(c){
    return c.match(req).then(function(hit){
      const red = fetch(req).then(function(resp){
        if(resp && resp.ok) c.put(req, resp.clone());
        return resp;
      }).catch(function(){ return null; });
      return hit || red.then(function(r){ return r || Response.error(); });
    });
  });
}

self.addEventListener("fetch", function(e){
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;   // la nube (Supabase), WhatsApp, etc.: directo a la red
  if(req.mode === "navigate"){ e.respondWith(paginaApp(req)); return; }
  e.respondWith(archivoLocal(req));                  // iconos y demás archivos de la misma carpeta
});
