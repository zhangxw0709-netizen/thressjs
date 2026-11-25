import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadScenario } from './map-data.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const result=await build({
  absWorkingDir:root,entryPoints:['src/main.js'],bundle:true,format:'iife',target:'es2020',
  minify:true,legalComments:'inline',charset:'utf8',write:false,
  plugins:[{
    name:'warcraft-map',
    setup(builder) {
      builder.onResolve({filter:/^athena:map$/},()=>({path:'first-wave',namespace:'map'}));
      builder.onLoad({filter:/.*/,namespace:'map'},()=>({contents:JSON.stringify(loadScenario()),loader:'json'}));
    },
  }],
});
const [template,css,license]=await Promise.all([
  readFile(path.join(root,'index.html'),'utf8'),readFile(path.join(root,'src/style.css'),'utf8'),
  readFile(path.join(root,'node_modules/three/LICENSE'),'utf8'),
]);
const style=/<link\b[^>]*href=["'](?:\.\/)?src\/style\.css["'][^>]*>/;
const script=/<script\b[^>]*src=["'](?:\.\/)?src\/main\.js["'][^>]*>\s*<\/script>/;
if (!style.test(template)||!script.test(template)) throw Error('游戏主页缺少样式或脚本入口');
const html=template.replace(style,()=>'<style>'+css+'</style>')
  .replace(script,()=>'<script type="module">\n/* '+license+' */\n'+result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'\n</script>');
await mkdir(path.join(root,'dist'),{recursive:true});
await writeFile(path.join(root,'dist/index.html'),html);
console.log('已生成可离线打开的游戏 '+path.join(root,'dist/index.html'));
