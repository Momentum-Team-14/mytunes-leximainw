const useProxy = false
const apiUrl = !useProxy ? 'https://itunes.apple.com/' : 'https://proxy-itunes-api.glitch.me/'

let searchCache = []
const searchReqTimeout = 5 * 1000
const searchWaitTimeout = 30 * 1000
const searchFoundTimeout = 15 * 60 * 1000

const elemAudio = document.querySelector('#audio-preview')
const elemCards = document.querySelector('#results')
const elemSearch = document.querySelector('#search')
let playingLoop
let progressBar

elemAudio.addEventListener('play', e => {
    const curr = document.querySelector('.result.selected')
    if (curr)
    {
        curr.classList.remove('paused')
    }
    progressUpdate(true)
})

elemAudio.addEventListener('pause', e => {
    const curr = document.querySelector('.result.selected')
    if (curr)
    {
        curr.classList.add('paused')
    }
    progressUpdate(false)
})

elemAudio.addEventListener('ended', e => {
    const card = document.querySelector('.result.selected')
    if (card)
    {
        card.classList.add('paused')
    }
})

elemSearch.addEventListener('submit', e => {
    e.preventDefault()
    const term = document.querySelector('#search input').value
    if (term === '')
    {
        return
    }
    const type = document.querySelector('#search select').value
    let url = `${apiUrl}search?term=${encodeURIComponent(term)}&media=music&entity=song`
    if (type !== '')
    {
        url += `&attribute=${type}`
    }
    const search = sendSearch(url, displayResults)
    if (search)
    {
        search.term = term
    }
    document.activeElement.blur()
    document.body.focus()
})

function displayResults(search)
{
    const currCard = document.querySelector('.result.selected')
    if (!search.fulfilled)
    {
        let errBanner
        if (!(errBanner = document.querySelector('#results .error')))
        {
            errBanner = document.createElement('div')
            errBanner.classList.add('error')
            elemCards.prepend(errBanner)
        }
        errBanner.innerText = "Couldn't get search results - try again later!"
        console.error(search.error)
        return
    }
    elemCards.innerHTML = ''
    let results = search.response.results
        .filter(x => x.wrapperType === 'track' && x.kind === 'song')
    if (currCard && !currCard.classList.contains('paused'))
    {
        elemCards.append(currCard.parentElement)
        if (results.some(x => x.trackId === currCard.trackId))
        {
            elemCards.removeCard = null
        }
        else
        {
            elemCards.removeCard = currCard.parentElement
        }
    }
    if (!results.length)
    {
        let errBanner
        if (!(errBanner = document.querySelector('#results .error')))
        {
            errBanner = document.createElement('div')
            errBanner.classList.add('error')
            elemCards.prepend(errBanner)
        }
        errBanner.innerText = `No results found for "${search.term}".`
    }
    else
    {
        results.slice(0, 50).forEach(result => {
            if (currCard && currCard.trackId === result.trackId)
            {
                elemCards.append(currCard.parentElement)
                elemCards.removeCard = null
                return
            }

            const releaseDate = new Date(result.releaseDate)
            const outer = elemCards.appendNew('div.result-outer')
            const elem = outer.appendNew('div.result')

            // artwork image
            elem.appendNew('img').src = result.artworkUrl100

            // play bar
            elem.appendNew('div.play-bar')
                .appendNew('div.bar')
                .appendNew('div.progress')

            // track name
            elem.appendNew('div').innerText = result.trackName

            // album name & release year
            let child = elem.appendNew('div')
            child.appendNew('span').innerText = result.collectionName
            child.append(' ')
            child.appendNew('span.text-sm').innerText
                = `(${releaseDate.getUTCFullYear()})`

            // artist name
            child = elem.appendNew('div')
            child.appendNew('span.text-sm').innerText = 'by'
            child.append(' ')
            child.appendNew('span').innerText = result.artistName

            // card data and click event
            elem.songUrl = result.previewUrl
            elem.trackId = result.trackId
            elem.addEventListener('click', () => playCard(elem))
        })
    }
}

function playCard(card)
{
    clearInterval(playingLoop)
    if (elemCards.removeCard && card.parentElement !== elemCards.removeCard)
    {
        // remove linger card when new card plays
        elemCards.removeChild(elemCards.removeCard)
        elemCards.removeCard = null

        // reflow card after new card so new card doesn't jump
        const indexOf = Array.from(elemCards.children).indexOf(card.parentElement)
        if (indexOf !== -1 && indexOf + 1 < elemCards.children.length)
        {
            elemCards.insertBefore(elemCards.children[indexOf + 1], card.parentElement)
        }
    }
    const curr = document.querySelector('.result.selected')
    if (curr)
    {
        if (curr === card)
        {
            const paused = curr.classList.contains('paused')
            if (paused)
            {
                curr.classList.remove('paused')
                elemAudio.play()
            }
            else
            {
                curr.classList.add('paused')
                elemAudio.pause()
            }
            progressBar = card.querySelector('.play-bar>.bar>.progress')
            progressUpdate(paused)
            return
        }
        else
        {
            curr.classList.remove('selected')
            curr.classList.remove('paused')
        }
    }
    elemAudio.src = card.songUrl
    card.classList.add('selected')
    progressBar = card.querySelector('.play-bar>.bar>.progress')
    progressUpdate(true)
    elemAudio.play()
}

function progressUpdate(playing)
{
    if (!progressBar)
    {
        return
    }
    if (playing)
    {
        if (isNaN(elemAudio.duration))
        {
            progressBar.style.width = "0%"
        }
        playingLoop = setInterval(() => progressLoop(progressBar), 10)
    }
    else
    {
        progressLoop(progressBar)
    }
}

function progressLoop(bar)
{
    bar.style.width = `${elemAudio.currentTime / elemAudio.duration * 100}%`
}

function seekCard(e, bar)
{
    e.stopPropagation()
    elemAudio.currentTime = e.offsetX / bar.clientWidth * elemAudio.duration
    progressLoop(bar.children[0])
}

function sendSearch(url, callback)
{
    const now = Date.now()
    searchCache = searchCache.filter(x => x.expires > now)
    if (searchCache.some(x => x.url === url))
    {
        const search = searchCache.find(x => x.url === url)
        search.callback(search)
        return
    }
    const search = {
        url,
        callback,
        expires: now + searchWaitTimeout
    }
    const controller = new AbortController()
    const timeoutID = setTimeout(() => controller.abort(), searchReqTimeout)
    fetch(url, {
        signal: controller.signal
    }).then(res => {
            search.ok = res.ok
            search.status = res.status
            clearTimeout(timeoutID)
            return res.json()
        })
        .then(data => {
            search.fulfilled = search.ok
            search.response = data
            search.expires = now + searchFoundTimeout
            search.callback(search)
        })
        .catch(err => {
            search.fulfilled = false
            search.error = err
            search.expires = now
            search.callback(search)
        })
    searchCache.push(search)
    return search
}

{
    const userMode = localStorage.getItem('user-style')
    if (userMode)
    {
        document.querySelector('#user-style').value = userMode
        document.querySelector('#user-style-link').href = `${userMode}.css`
    }
    document.querySelector('#user-style').addEventListener('change', e => {
        e.preventDefault()
        const style = e.target.value
        document.querySelector('#user-style-link').href = `${style}.css`
        localStorage.setItem('user-style', style)
    })
}

HTMLElement.prototype.appendNew = function(src)
{
    let elem
    let index = choice(src.indexOf(' '), src.length)
    let data = src.substring(0, index)
    let props = src.substring(index + 1)
    let classIndex = data.indexOf('.')
    let idIndex = data.indexOf('#')
    let hasId = false
    console.log(src)
    if (classIndex !== -1 || idIndex !== -1)
    {
        index = min(classIndex, idIndex)
        elem = document.createElement(data.substring(0, index))
        data = data.substring(index)
        while (classIndex !== -1 || idIndex !== -1)
        {
            const isId = data[0] === '#'
            if (isId)
            {
                if (hasId)
                {
                    console.error(`adding multiple IDs to new element (from ${src})`)
                }
                hasId = true
            }
            classIndex = data.indexOf('.', 1)
            idIndex = data.indexOf('#', 1)

            index = choice(min(classIndex, idIndex), data.length)
            const curr = data.substring(1, index)
            data = data.substring(index)
            if (curr === '')
            {
                console.error(`can't add empty ${isId ? 'id' : 'class'} (from ${src})`)
                continue
            }
            if (isId)
            {
                elem.setAttribute('id', curr)
            }
            else
            {
                elem.classList.add(curr)
            }
        }
    }
    else
    {
        elem = document.createElement(data)
    }

    // TODO: interpret properties

    this.appendChild(elem)
    return elem

    function choice(index, value)
    {
        return index !== -1 ? index : value
    }

    function min(left, right)
    {
        return left === -1 ? right : right === -1 ? left : left < right ? left : right
    }
}
