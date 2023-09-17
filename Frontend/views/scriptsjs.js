const targetEl = document.querySelector(".target");

const loadSnippet = number => {
    fetch(`./js-snippets/snippet-${number}.html`)
        .then(res => {
            if (res.ok){
                return res.text();
            }
        })
        .then(htmlSnippet => {
            targetEl.innerHTML = htmlSnippet;
        })
}