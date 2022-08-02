const useProxy = false
const apiUrl = useProxy ? 'https://itunes.apple.com/' : 'https://proxy-itunes-api.glitch.me/'

let searchCache = []
const searchWaitTimeout = 30 * 1000
const searchFoundTimeout = 15 * 60 * 1000

document.querySelector('#search').addEventListener('submit', e => {
    e.preventDefault()
    const url = `${apiUrl}search?term=${document.querySelector('#search input').value}`
    sendSearch(url, console.log)
})

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
