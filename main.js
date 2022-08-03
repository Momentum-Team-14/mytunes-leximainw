const useProxy = false
const apiUrl = !useProxy ? 'https://itunes.apple.com/' : 'https://proxy-itunes-api.glitch.me/'

let searchCache = []
const searchReqTimeout = 5 * 1000
const searchWaitTimeout = 30 * 1000
const searchFoundTimeout = 15 * 60 * 1000

document.querySelector('#search').addEventListener('submit', e => {
    e.preventDefault()
    const input = document.querySelector('#search input')
    const term = input.value
    if (term === '')
    {
        return
    }
    const url = `${apiUrl}search?term=${encodeURIComponent(term)}&media=music`
    sendSearch(url, displayResults).term = term
    document.activeElement.blur()
    document.body.focus()
})

document.querySelector('#audio-preview').addEventListener('ended', e => {
    const card = document.querySelector('.result.selected')
    if (card)
    {
        card.classList.add('paused')
    }
})

function displayResults(search)
{
    const resultsElem = document.querySelector('#results')
    if (!search.fulfilled)
    {
        console.log(search)
        let errBanner
        if (!(errBanner = document.querySelector('#results .error')))
        {
            errBanner = document.createElement('div')
            errBanner.classList.add('error')
            resultsElem.prepend(errBanner)
        }
        errBanner.innerText = "Couldn't get search results - try again later!"
        // TODO: inform user that search failed
        return
    }
    resultsElem.innerHTML = ''
    const results = search.response.results
        .filter(x => x.wrapperType === 'track' && x.kind === 'song')
    if (!results.length)
    {
        let errBanner
        if (!(errBanner = document.querySelector('#results .error')))
        {
            errBanner = document.createElement('div')
            errBanner.classList.add('error')
            resultsElem.prepend(errBanner)
        }
        errBanner.innerText = `Zero results found for "${search.term}".`
    }
    else
    {
        results.slice(0, 50).forEach(result => {
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
            elem.addEventListener('click', () => playCard(elem))
            outer.appendChild(elem)
            resultsElem.appendChild(outer)
        })
    }
}

function playCard(card)
{
    const curr = document.querySelector('.result.selected')
    const audio = document.querySelector("#audio-preview")
    if (curr)
    {
        if (curr === card)
        {
            const paused = curr.classList.contains('paused')
            if (paused)
            {
                curr.classList.remove('paused')
                audio.play()
            }
            else
            {
                curr.classList.add('paused')
                audio.pause()
            }
            return
        }
        else
        {
            curr.classList.remove('selected')
            curr.classList.remove('paused')
        }
    }
    audio.src = card.songUrl
    card.classList.add('selected')
    audio.play()
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
