/*jslint es6: true*/
/*global window, browser, Vue*/
(function () {

    const standardsDefaults = window.WEB_API_MANAGER.defaults;

    Vue.component("web-api-standards", {
        props: ["standards", "selectedStandards", "selectedDomain"],
        template: `
            <div class="web-api-standards-container">
                <h3>Pattern: <code>{{ selectedDomain }}</code></h3>

                <div class="panel panel-default form-horizontal">
                    <div class="panel-heading">
                        Default configurations
                    </div>

                    <div class="panel-body">
                        <button @click="onConservativeClicked">
                            Use Conservative Settings
                        </button>
                        <button @click="onAggressiveClicked">
                            Use Aggressive Settings
                        </button>
                    </div>
                </div>

                <div class="panel panel-default">
                    <div class="panel-heading">Blocked standards</div>

                    <ul class="list-group">
                        <li class="list-group-item" v-for="standard in standards">
                            <span v-if="standard.info.url" class="badge">
                                <a href="{{ standard.info.url }}">info</a>
                            </span>

                            <input type="checkbox"
                                :value="standard.info.idenitifer"
                                v-model="selectedStandards"
                                @change="onStandardChecked">
                            {{ standard.info.idenitifer }}
                        </li>
                    </ul>
                </div>
            </div>
        `,
        methods: {
            onStandardChecked: function () {
                this.$root.$data.setSelectedStandards(this.selectedStandards);
            },
            onConservativeClicked: function () {
                this.$root.$data.setSelectedStandards(standardsDefaults.conservative);
            },
            onAggressiveClicked: function () {
                this.$root.$data.setSelectedStandards(standardsDefaults.aggressive);
            }
        }
    });
}());