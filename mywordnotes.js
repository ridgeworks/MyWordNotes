(function () {
	window.mywordnotes = {}
	/* elements defined externally from main host HTML file
	mywordnotes.FILES
	mywordnotes.SRC
	mywordnotes.RENDER
	mywordnotes.EDIT_DONE
	mywordnotes.SAVE
	*/

	mywordnotes.init = function(ids, accessToken) {
		for (key in ids)	// id's indexed by key (list above)
			mywordnotes[key] = document.getElementById(ids[key])
		mywordnotes.dbx = new Dropbox({ accessToken: accessToken })
		mywordnotes.selected = null
		mywordnotes.SRC.addEventListener('keydown', keystroke)
		mywordnotes.SRC.addEventListener('input', function() {
			mywordnotes.SAVE.disabled = false
		})
		mywordnotes.renderObserver = new MutationObserver(function(mutations, observer) {
			if (typeof observer.scrollTop === 'number')	// restore scrollTop
				setScrollTop()
			observer.disconnect()		// and disconnect
		})
		setFilelist()

		function keystroke(event) { // replace tab functionality
			if ((event.metaKey || event.ctrlKey) && (event.keyCode === 83)) {		// command S?
				event.preventDefault()
				if (! mywordnotes.SAVE.disabled) {
					saveFile(false)
					return false
				}
			} else if (event.keyCode === 9 || event.which === 9) {
				event.preventDefault()
				document.execCommand('insertText', false, '\t')
			} else  event.stopPropagation()
			return false    // don't lose focus
		}

		function setScrollTop() {
			mywordnotes.RENDER.scrollTop = mywordnotes.renderObserver.scrollTop
			// Need to poll until render done?
			if (mywordnotes.RENDER.scrollTop !== mywordnotes.renderObserver.scrollTop) {
				setTimeout(setScrollTop, 100)
			}
		}

	}

	mywordnotes.control = function(button) {
		//console.log('mywordnotes.control:',button.textContent)
		removeInput()
		switch (button.textContent) {
			case '+':
				var input = document.createElement('input')
				input.setAttribute('type', 'text')
				input.setAttribute('size', '40')
				input.setAttribute('value', 'Untitled..')
				input.setAttribute('style', 'font-family:monospace; font-size: 14px')
				input.id = 'inputfilename'
				input.addEventListener('change', addFile)
				//input.addEventListener('cancel', function() {
				//	mywordnotes.FILES.parentNode.removeChild(input)
				//})
				mywordnotes.FILES.appendChild(input)
				deselect()
				input.select()
				break
			case '-':
				if (mywordnotes.selected) {
					var path = '/' + mywordnotes.selected.getAttribute('name')
					mywordnotes.dbx.filesDelete({ path: path })
						.then(function (response) {
							//console.log('Delete', path, 'succeeded.')
							mywordnotes.FILES.removeChild(mywordnotes.selected)
							editDone()
							mywordnotes.RENDER.innerHTML = ''
							mywordnotes.selected = null
						})
						.catch(function (error) {
							var msg = 'Delete' + path + 'failed: ' + JSON.stringify(error)
							console.error(msg)
							alert(msg)
						});
				}
				break
			case 'Edit': 
				if (mywordnotes.selected) {
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
			mywordnotes.SRC.innerHTML=''
			renderRefresh()
		})
		button.innerHTML = name.substr(0, name.length-4)
		return button
	}

	function edit(contents) {
		var height = mywordnotes.RENDER.clientHeight
		var srcheight = Math.round(height/3)
		mywordnotes.SRC.style.height = srcheight + 'px'
		mywordnotes.RENDER.style.height = (height - srcheight) + 'px'
		mywordnotes.SRC.innerText = contents
		mywordnotes.SRC.style.display = 'block'
		mywordnotes.SRC.scrollTop = 0
		mywordnotes.SAVE.style.display = 'inline'
		mywordnotes.EDIT_DONE.textContent = 'Done'
		editSource()
	}
		
	function select(button) {
		removeInput()
		deselect()
		mywordnotes.selected = button
		mywordnotes.deselectColor = button.style.backgroundColor
		button.style.backgroundColor = 'lightBlue'	
	}

	function deselect() {
		if (mywordnotes.selected) mywordnotes.selected.style.backgroundColor = mywordnotes.deselectColor
		mywordnotes.selected = null
		mywordnotes.RENDER.innerHTML = ''
	}

	function removeInput() {
		var input = document.getElementById('inputfilename')
		if (input) mywordnotes.FILES.removeChild(input)
	}

	function editSource() {
		mywordnotes.SAVE.disabled = true
		mywordnotes.SRC.focus()
	}

	function editDone()	{
		mywordnotes.RENDER.style.height = (mywordnotes.RENDER.clientHeight + mywordnotes.SRC.clientHeight) + 'px'
		mywordnotes.SRC.style.height = '0px'
		mywordnotes.SRC.style.display = 'none'
		mywordnotes.SAVE.style.display = 'none'
		mywordnotes.EDIT_DONE.textContent = 'Edit'
	}
	
	function renderRefresh() {
		// enable observer to update scrollTop
		mywordnotes.renderObserver.scrollTop = mywordnotes.RENDER.scrollTop
		mywordnotes.renderObserver.observe(mywordnotes.RENDER, {subtree: true, childList:true, characterData: true})
		// use include transform to support relative URLS
		mywordnotes.RENDER.textContent =
			'dropbox://' + mywordnotes.dbx.accessToken + '/' + mywordnotes.selected.getAttribute('name')
		x_markup.transformElement('include', mywordnotes.RENDER)
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
		var newName = this.value + '.myw'
		if (mywordnotes.FILES.querySelector('button[name="' + newName + '"]')) {
			alert(this.value + ' already exists. Choose a different name.')
			this.focus()
		} else {
			var newButton = fileButton(newName)
			mywordnotes.FILES.replaceChild(newButton, this)
			select(newButton)
			edit('')
			saveFile(true)
		}
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
			// console.log('Save', arg.path, 'succeeded.')
			if (contents)
				renderRefresh()		// something to render
			if (updateList)
				setFilelist()
			else 
				mywordnotes.RENDER.innerHTML = ''
			editSource()
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
