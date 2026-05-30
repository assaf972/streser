// Cypress support file — global commands and hooks

Cypress.Commands.add('login', () => {
    const email = Cypress.env('PERF_EMAIL');
    const password = Cypress.env('PERF_PASSWORD');

    cy.session([email], () => {
        cy.visit('/users/sign_in');
        cy.get('#user_email').type(email);
        cy.get('#user_password').type(password, { log: false });
        cy.get('[type="submit"]').click();
        cy.url().should('not.include', '/sign_in');
    });
});
