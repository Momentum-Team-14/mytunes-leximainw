const useProxy = false
const apiUrl = !useProxy ? 'https://itunes.apple.com/' : 'https://proxy-itunes-api.glitch.me/'

let searchCache = []
const searchWaitTimeout = 30 * 1000
const searchFoundTimeout = 15 * 60 * 1000

document.querySelector('#search').addEventListener('submit', e => {
    e.preventDefault()
    const term = document.querySelector('#search input').value
    if (term === '')
    {
        return
    }
    const url = `${apiUrl}search?term=${term}&media=music`
    sendSearch(url, displayResults)
})

function displayResults(search)
{
    if (!search.fulfilled)
    {
        // TODO: inform user that search failed
        return
    }
    const resultsElem = document.querySelector('#results')
    resultsElem.innerHTML = ''
    const results = search.response.results
        .filter(x => x.wrapperType === 'track' && x.kind === 'song')
    results.slice(0, 50).forEach(result => {
        const elem = document.createElement('div')
        elem.classList.add('result')
        let child = document.createElement('img')
        child.src = result.artworkUrl100
        child.addEventListener('click', e => {
            playSong(result)
        })
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
        resultsElem.appendChild(elem)
    })
    console.log(results[0])
}

function playSong(result)
{
    const audio = document.querySelector('#audio-preview')
    audio.src = result.previewUrl
    audio.play()
}

function sendSearch(url, callback)
{
    const now = Date.now()
    searchCache = searchCache.filter(x => x.expires > now)
    if (searchCache.some(x => x.url === url))
    {
        return
    }
    const search = {
        url,
        callback,
        expires: now + searchWaitTimeout
    }
    fetch(url)
        .then(res => {
            search.ok = res.ok
            search.status = res.status
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
}
