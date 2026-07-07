document.addEventListener('DOMContentLoaded', () => {
  const promptInput = document.getElementById('prompt-input');
  const charCountEl = document.getElementById('char-count');
  const exampleChips = document.querySelectorAll('.example-chip');
  const searchBtn = document.getElementById('search-btn');

  // 글자 수 카운터 업데이트
  const updateCharCount = () => {
    const currentLength = promptInput.value.length;
    charCountEl.textContent = `${currentLength}/200`;
  };

  // 텍스트 입력 시 이벤트 트리거
  promptInput.addEventListener('input', updateCharCount);

  // 예제 칩(육아, 노년, 반려동물) 클릭 시 텍스트 상자에 입력
  exampleChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const textToInsert = chip.getAttribute('data-text');
      promptInput.value = textToInsert;
      updateCharCount();
      promptInput.focus();
    });
  });

  // 엔터 키 입력 시 검색 실행 (Shift+Enter는 줄바꿈)
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      searchBtn.click();
    }
  });

  // 검색 버튼 클릭 이벤트
  searchBtn.addEventListener('click', () => {
    const sido = document.getElementById('sido-select').value;
    const promptText = promptInput.value.trim();

    if (!sido) {
      alert('시 / 도를 선택해주세요.');
      return;
    }

    if (!promptText) {
      alert('찾으시는 동네의 조건을 입력해주세요.');
      promptInput.focus();
      return;
    }

    // 사진과 동일한 에러 화면 UI가 유지되도록 안내 메시지 출력
    alert('현재 지도 API를 불러올 수 없는 상태입니다. (사진과 동일한 UI 상태 유지 중)');
  });
});