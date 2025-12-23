<style>
    .content-wrapper {
        background: #fff
    }
</style>
<script>
    window.$getVersion = () => {
        return '{{ getVersion() }}';
    }
    window.$user_status = () => {
        return '{{ $GLOBALS['limanData']['user']['status'] }}';;
    }
    window.$permissions = () => {
        let perms = JSON.parse('{!! json_encode($GLOBALS['limanData']['permissions']) !!}');
        return perms;
    }
    window.$can = (perm) => {
        let status = '{{ $GLOBALS['limanData']['user']['status'] }}';
        if (status === '1') {
            return true;
        }
        return window.$permissions().includes(perm);
    }
    window.$getServerIp = () => {
        return '{{ server()->ip_address }}';
    }
    $(".customAlert").remove();
</script>
<div id="app"></div>
<script type="module" src="https://localhost:5174/src/main.ts"></script>