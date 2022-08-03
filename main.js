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
            elemCards.appendNew([

                // outer container to keep all cards on a line the same height
                ['div.result-outer', outer => outer.appendNew([

                    // song card (holds album thumbnail and info about the song)
                    ['div.result', card => {
                        card.appendNew([

                            // album thumbnail
                            ['img', x => x.src = result.artworkUrl100],

                            // inner playbar for each card
                            ['div.play-bar', x => x.appendNew([
                                ['div.bar', x => {
                                    x.addEventListener('click', e => seekCard(e, x))
                                    x.appendNew('div.progress')
                                }]
                            ])],

                            // song name
                            ['div', x => x.innerText = result.trackName],

                            // album name and release year
                            ['div', x => x.appendNew([
                                ['span', x => x.innerText = result.collectionName],
                                '$ ',
                                ['span.text-sm', x => x.innerText
                                    = `(${releaseDate.getUTCFullYear()})`]
                            ])],

                            // artist name
                            ['div', x => x.appendNew([
                                ['span.text-sm', x => x.innerText = 'by'],
                                '$ ',
                                ['span', x => x.innerText = result.artistName]
                            ])]
                        ])

                        // card data & click handler
                        card.songUrl = result.previewUrl
                        card.trackId = result.trackId
                        card.addEventListener('click', () => playCard(card))
                    }]
                ])]
            ])
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

/// appendNew(src) - appends a new element to the given HTML element.
/// src may be a string or a mixed array of strings or arrays with a string and callback.
/// string format: "type#id.class1.class2 attr1=value attr2=value boolAttr"
/// or "$text" to append text instead of a new HTML element
/// returns the newly created element (or null for $text).
/// array format: ["stringFormat", ["stringFormat", x => x.doSomething()]]
/// returns null.
HTMLElement.prototype.appendNew = function(src)
{
    if (typeof(src) === 'object')
    {
        for (let subsrc of src)
        {
            if (typeof(subsrc) === 'object')
            {
                const elem = this.appendNew(subsrc[0])
                if (subsrc[1])
                {
                    subsrc[1](elem)
                }
            }
            else
            {
                this.appendNew(subsrc)
            }
        }
        return null
    }
    else
    {
        if (src.startsWith('$'))
        {
            this.append(src.substring(1))
            return null
        }

        let elem
        let index = choice(src.indexOf(' '), src.length)
        let data = src.substring(0, index)
        let props = src.substring(index + 1)
        let classIndex = data.indexOf('.')
        let idIndex = data.indexOf('#')
        let hasId = false
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

        while (props !== '')
        {
            index = 0
            let inString = false
            let escaped = false
            const chars = [...props]
            while (index < chars.length)
            {
                if (inString)
                {
                    if (escaped)
                    { escaped = false }
                    else if (chars[index] == '\\')
                    { escaped = true }
                    else if (chars[index] == '"')
                    { inString = false }
                }
                else if (chars[index] == '"')
                { inString = true }
                else if (chars[index] == ' ')
                { break }
                index++
            }
            const prop = props.substring(0, index)
            props = props.substring(index + 1)
            index = choice(prop.indexOf('='), prop.length)
            const key = prop.substring(0, index)
            const value = prop.substring(index + 1)
            let parsedValue = ""
            const valueChars = [...value]
            inString = false
            escaped = false
            for (let i = 0; i < valueChars.length; i++)
            {
                if (inString)
                {
                    if (escaped)
                    { parsedValue += valueChars[i] }
                    else if (valueChars[i] == '\\')
                    { escaped = true }
                    else if (valueChars[i] == '"')
                    { inString = false }
                    else
                    { parsedValue += valueChars[i] }
                }
                else if (valueChars[i] == '"')
                { inString = true }
                else if (valueChars[i] == ' ')
                { break }
                else
                { parsedValue += valueChars[i] }
            }
            elem.setAttribute(key, parsedValue)
        }

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
}
