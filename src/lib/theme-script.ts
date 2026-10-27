export const THEME_STORAGE_KEY = "lifeos.theme";
export const A11Y_STORAGE_KEY = "lifeos.a11y";

/**
 * Runs before paint so the correct theme, direction and text size are applied
 * on first render. Kept as a string so the root layout can inline it.
 */
export const PREHYDRATION_SCRIPT = `(function(){try{
var d=document.documentElement;
var t=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";
var dark=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
d.classList.toggle("dark",dark);
d.style.colorScheme=dark?"dark":"light";
var l=localStorage.getItem("lifeos.language")==="ur"?"ur":"en";
d.lang=l;d.dir=l==="ur"?"rtl":"ltr";
var a={};try{a=JSON.parse(localStorage.getItem("${A11Y_STORAGE_KEY}")||"{}")||{}}catch(e){}
d.dataset.textSize=a.largeText?"large":"normal";
d.dataset.contrast=a.highContrast?"high":"normal";
}catch(e){}})();`;
