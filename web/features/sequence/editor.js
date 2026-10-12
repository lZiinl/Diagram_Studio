const example=String.raw`// 첨부 그림을 바탕으로 만든 예제
component "SWC100 : ADC Conversion" #d9e8fb {
  unit adc "drv_adc\n(SWU101.1)\nASIL A" #d6ead0
}
component "SWC200 : Input Main Monitoring" #f7ceca {
  unit func "Appl_Function\n(SWU201.1)\nASIL A" #ffebcc
  unit check "Appl_InvolCheck\n(SWU201.2)\nASIL A" #ffebcc
}
component "SWC220 : Led Control" #f7ceca {
  unit led "Appl_Led\n(SWU221.1)\nASIL A" #ffebcc
}
component "SWC230 : Led DTC" #f7ceca {
  unit tell "Appl_TellTale\n(SWU231.1)\nASIL A" #ffebcc
  unit dtc "Appl_LedDtc\n(SWU231.2)\nASIL A" #ffebcc
}
adc -> func #009900 : VINVOL_TAIL\nVINVOL_STOP
space 12
func -> check : G_bFuncMode( func_ch )
func -> led : G_bFuncMode( func_ch )
func -> tell : G_bFuncMode( func_ch )
func -> dtc : G_bFuncMode( func_ch )
space 20
func -> check : G_wInvolAdc( func_ch )
space 18
check -> led : Get_byInvolMode( func_ch )
check -> tell : Get_byInvolMode( func_ch )
check -> dtc : Get_byInvolMode( func_ch )`;
const $=id=>document.getElementById(id);let svgText='',valid=false;
try{$('source').value=localStorage.getItem('sequence-source')||example;}catch{$('source').value=example;}
function refresh(){try{const model=Diagram.parse($('source').value);svgText=Diagram.render(model,{gap:$('gap').value,row:$('row').value});$('diagram').innerHTML=svgText;const svg=$('diagram').firstElementChild;svg.style.width=(+svg.getAttribute('width')*+$('zoom').value)+'px';svg.style.height=(+svg.getAttribute('height')*+$('zoom').value)+'px';$('status').className='';$('status').textContent=`${model.components.length} 컴포넌트 · ${model.units.length} 유닛 · ${model.events.filter(e=>e.from).length} 메시지`;valid=true;try{localStorage.setItem('sequence-source',$('source').value);}catch{$('status').textContent+=' · 자동 저장 불가';}}catch(e){valid=false;$('status').className='error';$('status').textContent=e.message+' (마지막 정상 미리보기 유지)';} $('svg').disabled=$('png').disabled=!valid;}
for(const id of ['source','gap','row','zoom'])$(id).addEventListener('input',refresh);
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('save').onclick=()=>download(new Blob([$('source').value],{type:'text/plain;charset=utf-8'}),'diagram.uml');
$('svg').onclick=()=>valid&&download(new Blob([svgText],{type:'image/svg+xml;charset=utf-8'}),'diagram.svg');
$('png').onclick=()=>{if(!valid)return;const url=URL.createObjectURL(new Blob([svgText],{type:'image/svg+xml;charset=utf-8'}));const img=new Image();img.onload=()=>{try{const scale=Math.min(2,8192/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.ceil(img.width*scale);c.height=Math.ceil(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);c.toBlob(b=>{if(b)download(b,'diagram.png');else alert('PNG 변환에 실패했습니다. SVG로 저장해 주세요.');},'image/png');}catch(e){alert('PNG 저장 오류: '+e.message);}finally{URL.revokeObjectURL(url);}};img.onerror=()=>{URL.revokeObjectURL(url);alert('이미지를 변환하지 못했습니다.');};img.src=url;};
$('example').onclick=()=>{if($('source').value!==example&&!confirm('현재 소스를 기본 예제로 바꿀까요? 필요한 소스는 먼저 저장해 주세요.'))return;$('source').value=example;refresh();};
$('load').onclick=()=>$('file').click();$('file').onchange=async()=>{const file=$('file').files[0];if(file){$('source').value=await file.text();refresh();$('file').value='';}};
$('source').addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const t=e.target,start=t.selectionStart,end=t.selectionEnd;t.setRangeText('  ',start,end,'end');refresh();}});
refresh();
