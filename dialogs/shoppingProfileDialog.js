// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { MessageFactory, CardFactory } = require('botbuilder');
const {
    AttachmentPrompt,
    ChoiceFactory,
    ChoicePrompt,
    ComponentDialog,
    ConfirmPrompt,
    DialogSet,
    DialogTurnStatus,
    NumberPrompt,
    TextPrompt,
    WaterfallDialog
} = require('botbuilder-dialogs');
const { Channels } = require('botbuilder-core');

const {
    SHOPPING_ACTION_OPTIONS_LIST_FOR_MAKING_CARD,
    SHOPPING_ITEM_OPTIONS_LIST_FOR_MAKING_CARD,
    // Dialog ID
    SHOPPING_DIALOG,
    // Prompt ID
    SHOPPING_ACTION_PROMPT,
    SHOPPING_ITEM_PROMPT,
    // Keyword to determine the answer
    SHOPPING_ACTION_KEYWORD,
    SHOPPING_ITEM_KEYWORD,
    // Action choices
    SHOPPING_ACTION_BUY,
    SHOPPING_ACTION_CHANGE,
    SHOPPING_ACTION_RETRIEVE,
    SHOPPING_ACTION_SELL,
    // Item choices
    SHOPPING_ITEM_CLOTHES,
    SHOPPING_ITEM_ACCESS,
    SHOPPING_ITEM_FURNITURE
} = require("../constants/shoppingString.json");



class ShoppingDialog extends ComponentDialog {
    constructor(dialogId, shoppingPropertyAccessor, optionListPropertyAccessor) {
        // validate what was passed in
        if (!dialogId) throw new Error("Missing parameter. dialogId is required");
        if (!optionListPropertyAccessor) throw new Error("Missing parameter. optionListPropertyAccessor is required");
        if (!shoppingPropertyAccessor) throw new Error("Missing parameter. shoppingPropertyAccessor is required");

        super(dialogId);
        this.dialogId = dialogId;

        this.shoppingPropertyAccessor = shoppingPropertyAccessor;
        this.optionListPropertyAccessor = optionListPropertyAccessor;

        this.addDialog(new TextPrompt(SHOPPING_ACTION_PROMPT, this.validateAction));
        this.addDialog(new TextPrompt(SHOPPING_ITEM_PROMPT, this.validateItem));

        this.addDialog(new WaterfallDialog(SHOPPING_DIALOG, [
            this.askActionStep.bind(this),
            this.askItemStep.bind(this),
            this.provideAnswerStep.bind(this)
        ]));

        this.initialDialogId = SHOPPING_DIALOG;
    }

    /**
     * The run method handles the incoming activity (in the form of a TurnContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     * @param {*} turnContext
     */
    async run(dialogContext) {
        await dialogContext.beginDialog(SHOPPING_DIALOG);
    }

    async askActionStep(step) {
        const { intent, action, item } = await this.shoppingPropertyAccessor.get(step.context, {});
        console.log(`in ask action step: { intent: ${intent}, action: ${action}, item: ${item} }`);

        if (intent) {
           return await step.next();
        } 
        if (action) {
            return await step.next();
        }

        const text = "Select the action you want: ";
        const reply = MessageFactory.attachment(
            CardFactory.adaptiveCard({
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.0",
                "body": [
                ],
                "actions": SHOPPING_ACTION_OPTIONS_LIST_FOR_MAKING_CARD
            }),
            text
        );

        return await step.prompt(SHOPPING_ACTION_PROMPT, reply);

    }

    async validateAction(promptContext) {
        // verify the user input contains the action
        let action; 
        for (let i=0; i<SHOPPING_ACTION_KEYWORD.length; i++) {
            if (promptContext.recognized.value.includes(SHOPPING_ACTION_KEYWORD[i])) {
                action = SHOPPING_ACTION_KEYWORD[i];
            }
        }

        if (action) {
            // add the latest option list to state
            return true;
        } else {
            // ask user what action they want again 
            const text = "Invalid action, select one of the actions below: ";
            const reply = MessageFactory.attachment(
                CardFactory.adaptiveCard({
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "type": "AdaptiveCard",
                    "version": "1.0",
                    "body": [
                    ],
                    "actions": SHOPPING_ACTION_OPTIONS_LIST_FOR_MAKING_CARD
                }),
                text
            );
            await promptContext.context.sendActivity(reply);
            return false;
        }
    }   

    async askItemStep(step) {
        // add the action options list to state
        await this.optionListPropertyAccessor.set(step.context, {
            dialogId: this.dialogId,
            promptId: SHOPPING_ACTION_PROMPT,
            shoppingProperty: {},
            optionList: SHOPPING_ACTION_OPTIONS_LIST_FOR_MAKING_CARD 
        });
        
        // access to state 
        let shoppingProperty = await this.shoppingPropertyAccessor.get(step.context, {});

        if (shoppingProperty.intent) {
            return await step.next();
        }

        // save the valid action to shoppingProperty state 
        let action; 
        if (shoppingProperty.action) {
            for (let i=0; i<SHOPPING_ACTION_KEYWORD.length; i++) {
                if (shoppingProperty.action.includes(SHOPPING_ACTION_KEYWORD[i])) {
                        action = SHOPPING_ACTION_KEYWORD[i];
                }
            }
        } else {
            for (let i=0; i<SHOPPING_ACTION_KEYWORD.length; i++) {
                if (step.result.includes(SHOPPING_ACTION_KEYWORD[i])) {
                        action = SHOPPING_ACTION_KEYWORD[i];
                }
            }
        }


        shoppingProperty.action = action;
        await this.shoppingPropertyAccessor.set(step.context, shoppingProperty);

        console.log(`in ask item step:{ intent: ${shoppingProperty.intent}, action: ${shoppingProperty.action}, item: ${shoppingProperty.item} }`);

        // do the next step based on the action user choosed 
        switch(action) {
            case SHOPPING_ACTION_BUY: 
            case SHOPPING_ACTION_CHANGE:
                const item = shoppingProperty.item;
                if (item) {
                    return await step.next();
                } else {
                    const text = (action === SHOPPING_ACTION_BUY) ? "what item you want to buy:" : "what item you want to change: "
                    const reply = MessageFactory.attachment(
                        CardFactory.adaptiveCard({
                            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                            "type": "AdaptiveCard",
                            "version": "1.0",
                            "body": [
                            ],
                            "actions": SHOPPING_ITEM_OPTIONS_LIST_FOR_MAKING_CARD
                        }),
                        text
                    );
                    return await step.prompt(SHOPPING_ITEM_PROMPT, reply);
                }

            case SHOPPING_ACTION_RETRIEVE:
            case SHOPPING_ACTION_SELL:
                return await step.next();
            default:
                throw new Error(`[ShoppingDialogError] : Unknown shopping action. Action : ${ action }`);
        }

    }

    async validateItem(promptContext) {
        let item;
        for (let i=0; i<SHOPPING_ITEM_KEYWORD.length; i++) {
            if (promptContext.recognized.value.includes(SHOPPING_ITEM_KEYWORD[i])) {
                item = SHOPPING_ITEM_KEYWORD[i];
            }
        }

        if (item) {
            return true;
        } else {
            // ask user what item they want again 
            const text = "Invalid item, select one of the items below: ";
            const reply = MessageFactory.attachment(
                CardFactory.adaptiveCard({
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "type": "AdaptiveCard",
                    "version": "1.0",
                    "body": [
                    ],
                    "actions": SHOPPING_ITEM_OPTIONS_LIST_FOR_MAKING_CARD
                }),
                text
            );
            await promptContext.context.sendActivity(reply);
            return false;
        }
        
    }

    async provideAnswerStep(step) {
        const shoppingProperty = await this.shoppingPropertyAccessor.get(step.context, {});

        // save the item option list to state
        await this.optionListPropertyAccessor.set(step.context, {
            dialogId: this.dialogId,
            promptId: SHOPPING_ITEM_PROMPT,
            shoppingProperty: { action: shoppingProperty.action },
            optionList: SHOPPING_ITEM_OPTIONS_LIST_FOR_MAKING_CARD
        });
        
        // fetch all the key values from the state 
        const intent = shoppingProperty.intent; 
        const action = shoppingProperty.action;
        const item = shoppingProperty.item ? shoppingProperty.item : step.result;
     
        console.log(`in provide answer step: { intent: ${intent}, action: ${action}, item:${item} }`);

        // routing to corresponding answer based on the intent, action or item collected 
        if (intent ) {
            if (intent === "RetrieveOrMoveFurniture") {
                await step.context.sendActivity("The ans of how to retrieve item: ....(done! finished the dialog)");
            }
            if (intent === "SellingFurniture") {
                await step.context.sendActivity("The ans of how to sell item: .... (done! finished the dialog)");
            }
        } else {
        // deciding the the ans based on the action first
            if (action === SHOPPING_ACTION_BUY) {
                // send the answer depending on the item 
                if (item === SHOPPING_ITEM_CLOTHES) {
                    await step.context.sendActivity(`The ans of ${action} ${item}: .... (done! finished the dialog)`);
                } else if (item === SHOPPING_ITEM_ACCESS) {
                    await step.context.sendActivity(`The ans of ${action} ${item}: .... (done! finished the dialog)`);
                } else if (item === SHOPPING_ITEM_FURNITURE) {
                    await step.context.sendActivity(`The ans of ${action} ${item}: .... (done! finished the dialog)`);
                }      
            } else if (action === SHOPPING_ACTION_CHANGE) {
                if (item === SHOPPING_ITEM_CLOTHES) {
                        await step.context.sendActivity(`The ans of ${action} ${item}: .... (done! finished the dialog)`);
                    } else if (item === SHOPPING_ITEM_ACCESS) {
                        await step.context.sendActivity(`The ans of ${action} ${item}: .... (done! finished the dialog)`);
                    } else if (item === SHOPPING_ITEM_FURNITURE) {
                        await step.context.sendActivity(`The ans of ${action} ${item}: .... (done! finished the dialog)`);
                    }
            } else if (action === SHOPPING_ACTION_RETRIEVE) {
                await step.context.sendActivity("The ans of how to retrieve item: ....(done! finished the dialog)");
            } else if (action === SHOPPING_ACTION_SELL) {
                await step.context.sendActivity("The ans of how to sell item: .... (done! finished the dialog)");
            } else {
                throw new Error(`[ShoppingDialogError] : Unknown shopping intent from user. Intent : ${ action }`);
            }

        }

        await this.shoppingPropertyAccessor.set(step.context, {});
        return await step.endDialog();
    }

}

module.exports.ShoppingDialog = ShoppingDialog;
