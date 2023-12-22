module.exports = function (Liquid) {
    this.registerFilter('militaryTime', (value) => {
        const [time, period] = value.split(' '); 
        const [hour, minute] = time.split(':'); 
        let formattedHour = parseInt(hour); 

        if (period === 'pm' || period === 'PM') { 
            formattedHour += 12; 
        } 

        return `${formattedHour}:${minute}`; 
    })
}