// 첨부 설계도의 입력 → 감시 → 제어 → 출력 구조를 단순화한 예시입니다.
const architectureExample = `// 신호 종류: ID "범례 이름" 색상 선 종류
// solid 실선 · dashed 파선 · dotted 점선 · dashdot 일점쇄선
signal normal "일반 신호" #475569 solid
signal fault "고장 신호" #ef4444 dashed
signal hw "HW–SW 인터페이스" #16a34a dotted

// column으로 열 지정 · 같은 열은 선언 순서대로 배치
component input "SWC401 : Input Output Conversion" #d9e8fb column 1 {
  unit adc "SWU401.1\\nDrv_Adc" #d6ead0 {
    in tail "Vcc_Tail"
    in stop "Vcc_Stop"
    in turn "Vcc_Turn"
    out voltage "VINVOL_TAIL"
    out bin "VTAILSTOP_BIN"
  }
  unit port "SWU401.2\\nDrv_Port" #d6ead0 {
    in sensed "TURN LED Fault Info."
    out fault "bFaultSig[TURN_FAULT]"
  }
}

component monitor "SWC402 : Input Voltage Monitoring" #f7ceca column 2 {
  unit func "SWU402.1\\nAppl_Function" #ffebcc {
    in voltage
    out mode "g_bFuncMode[func_ch]"
  }
  unit check "SWU402.2\\nAppl_InvolCheck" #ffebcc {
    in voltage
    out mode "g_byInvolMode[func_ch]"
  }
}

component fault "SWC405 : LED Fault Monitoring" #f7ceca column 2 {
  unit dtc "SWU405.1\\nAppl_LedDtc" #ffebcc {
    in sensed
    out fault "g_bLedFault[TURN_FAULT]"
  }
}

component bin "SWC404 : BIN Monitoring" #f7ceca column 2 {
  unit bin "SWU404.1\\nAppl_Bin" #ffebcc {
    in value
    out index "g_byBinIndex[bin_ch]"
  }
}

component tell "SWC406 : TELL-TALE" #f7ceca column 3 {
  unit tell "SWU406.1\\nAppl_TellTale" #ffebcc {
    in mode
    in voltage
    in fault
    out state "Tell-Tale State"
  }
}

component control "SWC403 : Current Control" #f7ceca column 3 {
  unit led "SWU403.1\\nAppl_Led" #ffebcc {
    in mode
    in voltage
    in fault
    in bin
    out tail "TAIL_LED_DUTY"
    out stop "STOP_LED_DUTY"
    out enable "TURN_ENABLE State"
  }
}

component output "SWC408 : Output Conversion" #d9e8fb column 4 {
  unit uart "SWU408.1\\nDrv_Uart" #d6ead0 {
    in tail
    in stop
    out tx "TxData"
  }
  unit outputPort "SWU408.2\\nDrv_Port" #d6ead0 {
    in received
    in enable
    out state "TELL-TALE OUT"
  }
}

// 같은 출력에서 여러 입력으로 분기
adc.voltage -> func.voltage
adc.voltage -> check.voltage
adc.bin -> bin.value
port.fault -> dtc.sensed fault
func.mode -> tell.mode
func.mode -> led.mode
check.mode -> tell.voltage
check.mode -> led.voltage
dtc.fault -> tell.fault fault
dtc.fault -> led.fault fault
bin.index -> led.bin
tell.state -> outputPort.received
led.tail -> uart.tail hw
led.stop -> uart.stop hw
led.enable -> outputPort.enable hw`;
