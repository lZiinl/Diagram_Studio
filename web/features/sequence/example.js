// 기본 예제는 편집기와 테스트가 동일한 내용을 사용하도록 분리합니다.
const example = String.raw`// 첨부 그림을 바탕으로 만든 예제
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
func -> check : G_bFuncMode( func_ch )
func -> led : G_bFuncMode( func_ch )
func -> tell : G_bFuncMode( func_ch )
func -> dtc : G_bFuncMode( func_ch )
func -> check : G_wInvolAdc( func_ch )
check -> led : Get_byInvolMode( func_ch )
check -> tell : Get_byInvolMode( func_ch )
check -> dtc : Get_byInvolMode( func_ch )`;

if (typeof module !== 'undefined') {
  module.exports = example;
}
