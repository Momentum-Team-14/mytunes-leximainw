const useProxy = false
const apiUrl = !useProxy ? 'https://itunes.apple.com/' : 'https://proxy-itunes-api.glitch.me/'

let searchCache = []
const searchReqTimeout = 5 * 1000
const searchWaitTimeout = 30 * 1000
const searchFoundTimeout = 15 * 60 * 1000

const elemAudio = document.querySelector('#audio-preview')
const elemCards = document.querySelector('#results')
const elemSearch = document.querySelector('#search')

elemSearch.addEventListener('submit', e => {
    e.preventDefault()
    const input = document.querySelector('#search input')
    const term = input.value
    if (term === '')
    {
        return
    }
    const url = `${apiUrl}search?term=${encodeURIComponent(term)}&media=music`
    const search = sendSearch(url, displayResults)
    if (search)
    {
        search.term = term
    }
    document.activeElement.blur()
    document.body.focus()
})

elemAudio.addEventListener('ended', e => {
    const card = document.querySelector('.result.selected')
    if (card)
    {
        card.classList.add('paused')
    }
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
        // TODO: inform user that search failed
        return
    }
    elemCards.innerHTML = ''
    let results = search.response.results
        .filter(x => x.wrapperType === 'track' && x.kind === 'song')
    if (currCard && !currCard.classList.contains('paused'))
    {
        elemCards.appendChild(currCard.parentElement)
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
        errBanner.innerText = `Zero results found for "${search.term}".`
    }
    else
    {
        results.slice(0, 50).forEach(result => {
            if (currCard && currCard.trackId === result.trackId)
            {
                elemCards.appendChild(currCard.parentElement)
                return
            }
            const outer = document.createElement('div')
            outer.classList.add('result-outer')
            const elem = document.createElement('div')
            elem.classList.add('result')
            let child = document.createElement('img')
            child.src = result.artworkUrl100
            elem.appendChild(child)
            child = document.createElement('div')
            child.innerText = result.trackName
            elem.appendChild(child)
            child = document.createElement('div')
            child.appendChild(document.createTextNode('by '))
            let span = document.createElement('span')
            span.innerText = result.artistName
            child.appendChild(span)
            elem.appendChild(child)
            elem.songUrl = result.previewUrl
            elem.trackId = result.trackId
            elem.addEventListener('click', () => playCard(elem))
            outer.appendChild(elem)
            elemCards.appendChild(outer)
        })
    }
}

function playCard(card)
{
    if (elemCards.removeCard && card != elemCards.removeCard)
    {
        elemCards.removeChild(elemCards.removeCard)
        elemCards.removeCard = null
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
    elemAudio.play()
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
