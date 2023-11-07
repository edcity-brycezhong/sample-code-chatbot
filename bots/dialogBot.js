// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory, CardFactory } = require('botbuilder');
const { DialogSet, DialogTurnStatus, ChoiceFactory } = require('botbuilder-dialogs');

const { ShoppingDialog } = require("../dialogs/shoppingProfileDialog");
const { SHOPPING_ACTION_LIST, SHOPPING_ITEM_LIST } = require("../constants/shoppingString.json");
const { MAPPING } = require("../constants/mapping_to_intent_and_entity.json");
const { SHOPPING_ACTION_PROMPT, SHOPPING_ITEM_PROMPT } = require("../constants/shoppingString.json");

const DIALOG_STATE_PROPERTY = "DialogStateProperty";
const SHOPPING_MAIN_DIALOG_ID = "shoppingMainDialog";
const SHOPPING_PROPERTY = "shoppingProperty";
const OPTION_LIST_PROPERTY = "optionListProperty";

class DialogBot extends ActivityHandler {
    /**
     *
     * @param {ConversationState} conversationState
     * @param {UserState} userState
     */
    constructor(conversationState, userState) {
        super();
        if (!conversationState) throw new Error('[DialogBot]: Missing parameter. conversationState is required');
        if (!userState) throw new Error('[DialogBot]: Missing parameter. userState is required');


        this.dialogState = conversationState.createProperty(DIALOG_STATE_PROPERTY);
        this.shoppingPropertyAccessor = conversationState.createProperty(SHOPPING_PROPERTY);
        this.optionListPropertyAccessor = conversationState.createProperty(OPTION_LIST_PROPERTY);
        this.dialogSet = new DialogSet(this.dialogState);
        this.dialogSet.add(new ShoppingDialog(SHOPPING_MAIN_DIALOG_ID, this.shoppingPropertyAccessor, this.optionListPropertyAccessor));

        this.conversationState = conversationState;
        this.userState = userState;

        this.intent = null;
        this.entity = null; 

        this.onMembersAdded(async (context, next) => {
            await this.showRootOptions(context);
            await next();
        });

        this.onMessage(async (context, next) => {
            console.log('Running dialog with Message Activity.');
            console.log('user input: ', context.activity.text);

            await this.dialogsRouter(context);

            await next();
        });
    }

    /**
     * Override the ActivityHandler.run() method to save state changes after the bot logic completes.
     */
    async run(context) {
        await super.run(context);

        // Save any state changes. The load happened during the execution of the Dialog.
        await this.conversationState.saveChanges(context, false);
        await this.userState.saveChanges(context, false);
    }

    async dialogsRouter(context) {
        const userInput = context.activity.text;

        await this.getEntityAndIntentBasedOnUserInput(userInput);

        const dialogContext = await this.dialogSet.createContext(context);
        let activeDialog = dialogContext.stack[0]?.id ? dialogContext.stack[0]?.id : null;

        const latestOptionList = await this.optionListPropertyAccessor.get(context, {});

        if(this.isUserInputContainsTheOptionInOptionList(userInput, latestOptionList) === true) {
            await dialogContext.cancelAllDialogs();
            await this.directedToCorrespondentDialog(dialogContext, latestOptionList);
        } else if (this.isUserInputContainsOptionInShoppingDialog(userInput) === true) {
            await this.setShoppingPropertyBasedOnUserInput(dialogContext);
            if (activeDialog === SHOPPING_MAIN_DIALOG_ID) {
                await dialogContext.continueDialog();
            } else {
                await dialogContext.beginDialog(SHOPPING_MAIN_DIALOG_ID);
            }
        } else {
            await dialogContext.cancelAllDialogs();
            await this.showRootOptions(context);
        }

    }

    async getEntityAndIntentBasedOnUserInput(userInput) {
        if (userInput in MAPPING) {
            this.entity = MAPPING[userInput].entity;
            this.intent = MAPPING[userInput].intent;
        } else {
            this.entity = null;
            this.intent = null;
        }
    }

    isUserInputContainsTheOptionInOptionList(userInput, latestOptionList) {
        const optionList = latestOptionList.optionList;
        let isTheOption = false;
        if (optionList && latestOptionList.promptId) {
            for (let i=0; i<optionList.length; i++) {
                if (userInput === optionList[i].data) {
                    isTheOption = true;
                }
            }
        }

        return isTheOption
    }

    isUserInputContainsOptionInShoppingDialog(userInput) {
        return SHOPPING_ACTION_LIST.includes(userInput) || SHOPPING_ITEM_LIST.includes(userInput) || userInput === "About shopping"
    }

    async directedToCorrespondentDialog(dialogContext, latestOptionList) {
        const userInput = dialogContext.context.activity.text; 
        let { promptId, shoppingProperty } = await this.optionListPropertyAccessor.get(dialogContext.context, {});

        switch (promptId) {
            case SHOPPING_ACTION_PROMPT:
                shoppingProperty.action = userInput;
                break;
            case SHOPPING_ITEM_PROMPT:
                shoppingProperty.item = userInput;
                break;
            default:
                shoppingProperty = {};
        }

        console.log("set shoppingProperty before get into shopping dialog:", shoppingProperty);

        await this.shoppingPropertyAccessor.set(dialogContext.context, shoppingProperty);
        await dialogContext.beginDialog(SHOPPING_MAIN_DIALOG_ID);

    }

    async setShoppingPropertyBasedOnUserInput(dialogContext) {
        let shoppingProperty = await this.shoppingPropertyAccessor.get(dialogContext.context, {});
        shoppingProperty.intent = this.intent ? this.intent : null;
        
        const actions = ["change", "buy", "sell", "retrieve"];
        const items = ["Clothes", "Accessories", "Furniture"];

        if (actions.includes(this.entity)) {
            shoppingProperty.action = this.entity;
        } else if (items.includes(this.entity)) {
            shoppingProperty.item = this.entity;
        }

        console.log("set shoppingProperty before get into shopping dialog:", shoppingProperty);

        await this.shoppingPropertyAccessor.set(dialogContext.context, shoppingProperty);
    }

    async showRootOptions(context) {
        const text = "Only shopping option is avaiable for testing, other options are not available in this demo";
        const options = [
            {
                "type": "Action.Submit",
                "title": "Game Recommendation",
                "data": "Game Recommendation"
            },
            {
                "type": "Action.Submit",
                "title": "About coins",
                "data": "About coins"
            },
            {
                "type": "Action.Submit",
                "title": "About shopping",
                "data": "About shopping"
            },
            {
                "type": "Action.Submit",
                "title": "Small Knowledge",
                "data": "Small Knowledge"
            },
        ];
        const reply = MessageFactory.attachment(
            CardFactory.adaptiveCard({
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.0",
                "body": [
                ],
                "actions": options
            }),
            text
        );

        return await context.sendActivity(reply);
    }
}

module.exports.DialogBot = DialogBot;
