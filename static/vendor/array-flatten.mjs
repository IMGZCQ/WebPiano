/* esm.sh - array-flatten@3.0.0 */
function o(t){var r=[];return e(t,r),r}function e(t,r){for(var n=0;n<t.length;n++){var f=t[n];Array.isArray(f)?e(f,r):r.push(f)}}export{o as flatten};
//# sourceMappingURL=array-flatten.mjs.map