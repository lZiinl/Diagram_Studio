// 브라우저별 저장 방식의 차이를 편집기 이벤트에서 분리합니다.
(function (root) {
  'use strict';

  function safeFilename(name, extension) {
    const basename =
      name
        .trim()
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
        .replace(/[. ]+$/g, '') || 'diagram';
    return basename.toLowerCase().endsWith(extension) ? basename : basename + extension;
  }

  /**
   * 클릭 핸들러에서 즉시 호출합니다. PNG 변환보다 먼저 저장 창을 열어야
   * 사용자 동작 권한이 만료되지 않습니다. 취소 시 파일을 만들지 않습니다.
   * createBlob은 저장 위치 선택 후 실행되는 비동기 데이터 생성 함수입니다.
   */
  async function save({ name, extension, mimeType, description, createBlob }) {
    const suggestedName = safeFilename(name, extension);

    if (typeof root.showSaveFilePicker === 'function') {
      let handle;
      try {
        handle = await root.showSaveFilePicker({
          suggestedName,
          types: [{ description, accept: { [mimeType]: [extension] } }],
        });
      } catch (error) {
        if (error.name === 'AbortError') {
          return false;
        }
        throw error;
      }

      const blob = await createBlob();
      const writable = await handle.createWritable();
      try {
        await writable.write(blob);
        await writable.close();
      } catch (error) {
        // 쓰기 실패 시 미완성 내용을 기존 파일에 반영하지 않습니다.
        try {
          await writable.abort();
        } catch {
          // 원래 쓰기 오류를 유지합니다.
        }
        throw error;
      }
      return true;
    }

    // 일부 브라우저에서는 웹 페이지가 저장 위치 창을 직접 열 수 없습니다.
    const chosenName = root.prompt(
      '저장할 파일 이름을 입력하세요.\n이 브라우저의 저장 위치는 다운로드 설정을 따릅니다.\n폴더를 고르려면 브라우저의 “저장 위치를 매번 확인” 설정을 켜 주세요.',
      suggestedName,
    );
    if (chosenName === null) {
      return false;
    }

    const blob = await createBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeFilename(chosenName, extension);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  root.DiagramFileSave = { save, safeFilename };
  if (typeof module !== 'undefined') {
    module.exports = root.DiagramFileSave;
  }
})(typeof window !== 'undefined' ? window : globalThis);
