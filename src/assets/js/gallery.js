let galleries = document.querySelectorAll(".c-gallery")

let paginateCards = (showCards, paginateCardAmount, tiles, totalTiles, button) => {
    for (let x = showCards; x < (showCards + paginateCardAmount); x++)
        tiles[x]?.classList.remove("c-gallery__tiles__tile--hidden")   

    showCards += paginateCardAmount

    if (totalTiles <= showCards)
        button.style.display = "none"

    return showCards
}

galleries.forEach(gallery => {
    let tileContainer = gallery.querySelector('.c-gallery__tiles')
    let tiles = tileContainer.children;
    let totalTiles = tiles.length;
    let button = gallery.querySelector('.c-gallery__button')
    let paginateCardAmount = window.innerWidth >= 769 ? 6 : 3
    let showCards = paginateCards(0, paginateCardAmount, tiles, totalTiles, button)

    gallery.querySelector('.c-button').addEventListener("click", e => {
        showCards = paginateCards(showCards, paginateCardAmount, tiles, totalTiles, button)
    });
});