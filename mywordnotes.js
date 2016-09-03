(function () {
	window.mywordnotes = {}
	/* elements set externally from main host HTML file
	mywordnotes.FILES
	mywordnotes.SRC
	mywordnotes.RENDER
	mywordnotes.EDIT_DONE
	mywordnotes.SAVE
	*/
	
	mywordnotes.init = function(dbx) {
		mywordnotes.dbx = dbx
		mywordnotes.selected = null
		mywordnotes.SRC.addEventListener('keydown', keystroke)
		setFilelist()
	}

	mywordnotes.control = function(button) {
		//console.log('mywordnotes.control:',button.textContent)
		switch (button.textContent){
			case '+': 
				var input = document.createElement('input')
				input.setAttribute('type', 'text')
				input.setAttribute('size', '40')
				input.setAttribute('value', 'Untitled..')
				input.setAttribute('style', 'font-family:monospace; font-size: 14px')
				input.addEventListener('change', addFile)
				mywordnotes.FILES.appendChild(input)
				break
			case '-': 
				var path = '/' + mywordnotes.selected.getAttribute('name')
				mywordnotes.dbx.filesDelete({path: path})
				.then(function(response) {
					console.log('Delete', path, 'succeeded.')
					mywordnotes.FILES.removeChild(mywordnotes.selected)	
					editDone()
					mywordnotes.RENDER.innerHTML = ''
				})
				.catch(function(error) {
					var msg = 'Delete' + path + 'failed: ' + JSON.stringify(error)
					console.error(msg)
				  	alert(msg)
				});			
				break
			case 'Edit': 
				if (mywordnotes.selected) {
					mywordnotes.RENDER.style.height = '300px'
					var path = '/' + mywordnotes.selected.getAttribute('name')					
					filesDownload(path, edit)
				}
				break
			case 'Done': 
				editDone()
				break
			case 'Save': 
				saveFile(false)
				break
			default: console.log('Unknown control button:', button.textContent)
		}
	}
	
	function fileButton(name) {
		var button = document.createElement('button');
		button.setAttribute('class', 'filebutton')
		button.setAttribute('name', name)
		button.addEventListener('click', function() {
			select(this)
			editDone()
			renderRefresh()
		})
		button.innerHTML = name.substr(0, name.length-4)
		return button
	}

	function keystroke(event) { // replace tab functionality
	  mywordnotes.SAVE.disabled = false
	  if (event.keyCode == 9 || event.which == 9) {
		document.execCommand('insertText', false, '\t')
		event.preventDefault()
	  } else event.stopPropagation()
	  return false    // don't lose focus
	}

	function edit(contents) {
		mywordnotes.SRC.innerText = contents
		mywordnotes.SRC.parentElement.style.display = 'block'
		mywordnotes.SAVE.style.display = 'inline'
		mywordnotes.SAVE.disabled = true
		mywordnotes.EDIT_DONE.textContent = 'Done'
	}
		
	function select(button) {
		if (mywordnotes.selected) mywordnotes.selected.style.backgroundColor = mywordnotes.deselectColor
		mywordnotes.selected = button
		mywordnotes.deselectColor = button.style.backgroundColor
		button.style.backgroundColor = 'lightBlue'	
	}

	function editDone()	{
		mywordnotes.SRC.parentElement.style.display = 'none'
		mywordnotes.RENDER.style.height = '600px'
		mywordnotes.SAVE.style.display = 'none'
		mywordnotes.EDIT_DONE.textContent = 'Edit'
	}
	
	function renderRefresh() {
		// use include transform to support relative URLS
		mywordnotes.RENDER.textContent = 
			'dropbox://' + mywordnotes.dbx.accessToken + '/' + mywordnotes.selected.getAttribute('name')
		x_markup.transformElement('include', mywordnotes.RENDER)
		/*
		mywordnotes.dbx.sharingCreateSharedLinkWithSettings({path: '/' + mywordnotes.selected.getAttribute('name')})
		.then(function(response) {
			console.log(response.url)
			mywordnotes.RENDER.textContent = response.url
				//'dropbox://' + mywordnotes.dbx.accessToken + '/' + mywordnotes.selected.getAttribute('name')
			x_markup.transformElement('include', mywordnotes.RENDER)
		})
		.catch(function(error) {
			//mywordnotes.RENDER.innerHTML = ['<mark>CreateSharedLink error', error, '</mark>'].join('')
			console.log(error)
		})*/
	}

	function setFilelist() {
		mywordnotes.dbx.filesListFolder({path: ''})
		.then(function(response) {
			mywordnotes.FILES.innerHTML = ''
			var items = response.entries
			items.sort(function (a, b) {
				var aname = a.name.toLowerCase(), bname = b.name.toLowerCase()
				return (aname < bname) ? -1 : ((aname > bname) ? 1 : 0)
			})
			var selected 
			items.forEach(function(item) {
				if (item.name.endsWith('.myw')) {
					var newbutton = fileButton(item.name)
					if (mywordnotes.selected && (item.name === mywordnotes.selected.name))
						select(newbutton)
					mywordnotes.FILES.appendChild(newbutton)
				}
			})
		})
		.catch(function(error) {
			mywordnotes.FILES.innerHTML = ['<mark>', error, '</mark>'].join('')
			console.log(error)
		})
	}
	
	function addFile() {
		var newButton = fileButton(this.value + '.myw')
		mywordnotes.FILES.replaceChild(newButton, this)
		select(newButton)
		mywordnotes.RENDER.style.height = '300px'
		edit('')
		saveFile(true)
	}
	
	function saveFile(updateList) {
		var contents = mywordnotes.SRC.innerText
		var arg = {
			contents : contents,
			path : '/' + mywordnotes.selected.getAttribute('name'),
			mode : 'overwrite',
			mute : true
		}
		mywordnotes.dbx.filesUpload(arg)
		.then(function(response) {
			console.log('Save', arg.path, 'succeeded.')
			if (contents)
				renderRefresh()		// something to render
				if (updateList) setFilelist()
			else 
				mywordnotes.RENDER.innerHTML = ''
			mywordnotes.SAVE.disabled = true
		})
		.catch(function(error) {
			var msg = 'Save' + arg.path + 'failed: ' + JSON.stringify(error)
			console.error(msg)
			alert(msg)
		});
	}
	
	function filesDownload(path, onload){	// HTTP only version for Worker pre-test
		var DOWNLOAD_URL = 'https://content.dropboxapi.com/2/files/download'
		var request = new XMLHttpRequest()
		request.open('POST', DOWNLOAD_URL, true)
		request.setRequestHeader('Authorization','Bearer ' + mywordnotes.dbx.accessToken)
		request.setRequestHeader('Dropbox-API-Arg', '{"path" : "' + path + '"}')
		request.onload = function() {
			if (request.status === 200)
				onload(request.responseText)
			else downloadError()
		}
		request.onerror = downloadError
		request.send()
		
		function downloadError() {
			var msg = 'Download' + path + 'failed: ' + request.status
			console.error(msg)
			alert(msg)
		}
	}

}())
		/*mywordnotes.dbx.filesDownload({path: '/'+path})	// picky dropbox wants '/'?
				.then(function(response) {
					//console.log(response.fileBlob)
					var reader = new FileReader()
					reader.onloadend = function() {
						//console.log(reader.result)
						mywordnotes.SRC.innerText = reader.result
						if (mywordnotes.selected) mywordnotes.selected.style.backgroundColor = 'white'
						mywordnotes.selected = target
						mywordnotes.selected.style.backgroundColor = 'lightBlue'
						var toRender = mywordnotes.RENDER
						toRender.textContent = reader.result
						x_markup.transformElement('myword', toRender)
					}
					reader.readAsText(response.fileBlob)
				})
				.catch(function(error) {
				  console.log(error);
				});
				*/
		//console.log(path,' :\n',contents)
