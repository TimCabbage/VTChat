const IDProvider = {
    current: 0,
    get: function() {
        IDProvider.current += 1;
        return IDProvider.current;
    }
}

export default IDProvider;