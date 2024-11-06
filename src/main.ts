// todo
// src/main.ts

// Function to create a button and append it to the body
function createButton() {
  const button = document.createElement("button");
  button.textContent = "Click me!";
  button.onclick = () => alert("You clicked the button!");
  document.body.appendChild(button);
}

// Call the function to create the button
createButton();
