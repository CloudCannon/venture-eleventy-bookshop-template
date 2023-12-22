let typingTimer;
const doneTypingInterval = 1000;

function validateInput(input) {
    const errorContainer = input.parentElement.querySelector('.error');
    const errorText = errorContainer.querySelector(".error__text")

    if (input.checkValidity()) {
        errorContainer.style.display = "none";
        input.removeAttribute('aria-invalid')
        input.removeAttribute('aria-errormessage')
    } else {
        errorContainer.style.display = "flex";
        errorText.textContent = input.validationMessage;
        input.setAttribute('aria-invalid', true)
        input.setAttribute('aria-errormessage', errorText.id)
    }
}

function validateInputGroup(input) {
    const errorContainer = input.parentElement.querySelector('.error');

    let invalidElements = input.querySelectorAll(":invalid");
    invalidElements = [
        ...invalidElements
    ];

    if (invalidElements.length == 0) {
        input.removeAttribute('aria-invalid')
        input.removeAttribute('aria-errormessage')
        errorContainer.style.display = "none";
    }
}

function validateInputTyping(input){
    // Wait for a user to stop typing and display an error message if their input is invalid
    clearTimeout(typingTimer);
    
    typingTimer = setTimeout(function() {
        validateInput(input)
    }, doneTypingInterval);
}

function validateFormSubmit(event, element) {
    let invalidElements = element.querySelectorAll(":invalid");

    invalidElements = [
        ...invalidElements
    ];
    invalidElements = invalidElements.filter(input => input.type != "radio" && input.type != "checkbox");
    
    for (index in invalidElements) {
        let item = invalidElements[index];
        let errorContainer = item.parentElement.querySelector('.error');
        let errorText = errorContainer.querySelector(".error__text")
        if (item.validationMessage) {
            errorContainer.style.display = "flex";
            item.setAttribute('aria-invalid', true)
            item.setAttribute('aria-errormessage', errorText.id)
            errorText.textContent = item.validationMessage;
        } else if (item.querySelector(':invalid')) {
            errorContainer.style.display = "flex";
            item.setAttribute('aria-invalid', true)
            item.setAttribute('aria-errormessage', errorText.id)
            errorText.textContent = item.querySelector(':invalid').validationMessage;
        }
    }

    if (invalidElements.length > 0) {
        event.preventDefault();
        invalidElements[0].focus();
        return false
    } else {
        return true;
    }

}

window.validateInput = validateInput;
window.validateInputTyping = validateInputTyping;
window.validateInputGroup = validateInputGroup;
window.validateFormSubmit = validateFormSubmit;

// If the min or max value of the provided input should be the current date, set the attribute
function setMinMaxDateToday(input) {
    let today = new Date();
    let dd = today.getDate();
    let mm = today.getMonth() + 1;
    let yyyy = today.getFullYear();

    if (dd < 10) {
        dd = '0' + dd;
    }

    if (mm < 10) {
        mm = '0' + mm;
    } 
                    
    today = yyyy + '-' + mm + '-' + dd;
    
    if (input.classList.contains("c-date-input__input--min-today")) {
        input.setAttribute("min", today);
    } else if (input.classList.contains("c-date-input__input--max-today")) {
        input.setAttribute("max", today);
    }
}

window.setMinMaxDateToday = setMinMaxDateToday;