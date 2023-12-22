module.exports = {
    engines: {
        "@bookshop/eleventy-engine": {
            "plugins": ["./assign_local.js", "./image.js", "./military_time.js", "./ymlify.js"]
        }
    }
}
